// app/api/leads/search/route.ts
// Added: AI-powered query parsing + 2-Layer Result Caching (Memory + DB)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const GOOGLE_API_KEY =
  process.env.GOOGLE_PLACES_API_KEY ||
  process.env.GOOGLE_MAPS ||
  process.env.NEXT_PUBLIC_GOOGLE_MAPS ||
  "";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

// ─────────────────────────────────────────────────────────────────────────────
// 🗄️  2-LAYER CACHE SYSTEM
//
//  Layer 1 — In-Memory Cache (Map)
//    • Ultra-fast (0ms lookup), lives as long as the server process is running
//    • Resets on server restart / cold start (Vercel serverless caveat below)
//    • TTL: MEMORY_CACHE_TTL_MS (default 30 min)
//
//  Layer 2 — Database Cache (SearchCache table in Prisma)
//    • Survives server restarts and works across multiple serverless instances
//    • TTL: DB_CACHE_TTL_HOURS (default 24 h)
//    • Falls back to full Google + OpenAI calls only when both layers miss
//
//  Cache Key = normalised searchQuery (lowercase, trimmed, spaces collapsed)
//  e.g. "restaurants lahore" and "Restaurants  Lahore" → same key
//
//  ⚠️  Prisma model required — add this to your schema.prisma and run
//      `npx prisma db push` or `npx prisma migrate dev`:
//
//  model SearchCache {
//    id          String   @id @default(cuid())
//    cacheKey    String   @unique
//    leadsJson   String   @db.Text
//    location    String
//    createdAt   DateTime @default(now())
//    expiresAt   DateTime
//  }
// ─────────────────────────────────────────────────────────────────────────────

const MEMORY_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const DB_CACHE_TTL_HOURS  = 24;              // 24 hours

interface CacheEntry {
  leads: LeadResult[];
  location: string;
  expiresAt: number; // epoch ms
}

// In-memory store — module-level singleton (shared across requests on same instance)
const memoryCache = new Map<string, CacheEntry>();

/** Normalise a query string into a stable cache key */
function toCacheKey(query: string): string {
  return query.toLowerCase().trim().replace(/\s+/g, " ");
}

/** Layer 1: read from in-memory cache */
function readMemoryCache(key: string): LeadResult[] | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  console.log("⚡ Cache HIT (memory):", key);
  return entry.leads;
}

/** Layer 1: write to in-memory cache */
function writeMemoryCache(key: string, leads: LeadResult[], location: string): void {
  memoryCache.set(key, {
    leads,
    location,
    expiresAt: Date.now() + MEMORY_CACHE_TTL_MS,
  });
}

/** Layer 2: read from DB cache */
async function readDBCache(key: string): Promise<LeadResult[] | null> {
  try {
    const row = await (db as any).searchCache.findUnique({
      where: { cacheKey: key },
    });
    if (!row) return null;
    if (new Date() > new Date(row.expiresAt)) {
      // Expired — delete asynchronously, don't await
      (db as any).searchCache.delete({ where: { cacheKey: key } }).catch(() => {});
      return null;
    }
    console.log("💾 Cache HIT (database):", key);
    return JSON.parse(row.leadsJson) as LeadResult[];
  } catch {
    // SearchCache table may not exist yet — silently skip
    return null;
  }
}

/** Layer 2: write to DB cache (upsert so re-searches refresh TTL) */
async function writeDBCache(
  key: string,
  leads: LeadResult[],
  location: string
): Promise<void> {
  try {
    const expiresAt = new Date(
      Date.now() + DB_CACHE_TTL_HOURS * 60 * 60 * 1000
    );
    await (db as any).searchCache.upsert({
      where: { cacheKey: key },
      update: { leadsJson: JSON.stringify(leads), location, expiresAt },
      create: { cacheKey: key, leadsJson: JSON.stringify(leads), location, expiresAt },
    });
  } catch {
    // Silently skip if table doesn't exist yet
  }
}

// ─────────────────────────────────────────────────────────────────────────────

interface PlaceResult {
  place_id: string;
  name: string;
  formatted_address?: string;
  formatted_phone_number?: string;
  international_phone_number?: string;
  website?: string;
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
  opening_hours?: { open_now: boolean };
}

interface LeadResult {
  placeId: string;
  company: string;
  address: string;
  phone: string;
  email: string | null;
  website: string;
  industry: string;
  rating: number | null;
  reviewCount: number;
  score: number;
  priority: string;
  aiInsight: string;
  linkedinUrl: string;
  fromCache?: boolean; // shows in response if result came from cache
}

// ─────────────────────────────────────────────────────────────────────────────
// AI QUERY PARSER
// ─────────────────────────────────────────────────────────────────────────────

async function parseUserQuery(
  keyword: string,
  industry: string,
  location: string
): Promise<{ searchQuery: string; extractedLocation: string }> {
  const wordCount = keyword.trim().split(/\s+/).length;
  const isSimple =
    wordCount <= 4 && !keyword.includes("?") && !keyword.includes(",");

  if (isSimple || !OPENAI_API_KEY) {
    const parts = [keyword, industry, location].filter(Boolean);
    return { searchQuery: parts.join(" "), extractedLocation: location };
  }

  try {
    const prompt = `You are a lead generation assistant. A user typed this search query:
"${keyword}"
${industry ? `They also selected industry: "${industry}"` : ""}
${location ? `They also typed location: "${location}"` : ""}

Extract from this the best Google Places search query (3-6 words max, like "software companies Lahore" or "dental clinics Dubai").
Also extract the city/location mentioned.

Reply ONLY with valid JSON, no explanation:
{
  "searchQuery": "...",
  "location": "..."
}`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "";
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    console.log("🤖 AI parsed query:", parsed);

    return {
      searchQuery:
        parsed.searchQuery ||
        [keyword, industry, location].filter(Boolean).join(" "),
      extractedLocation: parsed.location || location,
    };
  } catch (err) {
    console.error("AI query parsing failed, falling back:", err);
    const parts = [keyword, industry, location].filter(Boolean);
    return { searchQuery: parts.join(" "), extractedLocation: location };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE PLACES HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function getPlaceDetails(placeId: string): Promise<PlaceResult | null> {
  const fields =
    "place_id,name,formatted_address,formatted_phone_number,international_phone_number,website,rating,user_ratings_total,types,opening_hours";
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${GOOGLE_API_KEY}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    if (data.status === "OK") return data.result;
    return null;
  } catch {
    return null;
  }
}

async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
    query
  )}&key=${GOOGLE_API_KEY}`;
  console.log("🔍 Google Places API call:", query);
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  console.log("Google status:", data.status, data.error_message || "");
  if (data.status !== "OK" || !data.results?.length) return [];
  const details = await Promise.all(
    data.results.slice(0, 10).map((r: any) => getPlaceDetails(r.place_id))
  );
  return details.filter(Boolean) as PlaceResult[];
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function guessEmail(website: string): string | null {
  if (!website) return null;
  try {
    const domain = website
      .replace(/https?:\/\//, "")
      .split("/")[0]
      .replace(/^www\./, "");
    return `info@${domain}`;
  } catch {
    return null;
  }
}

function inferIndustry(types: string[]): string {
  const map: Record<string, string> = {
    restaurant: "Food & Beverage",
    food: "Food & Beverage",
    cafe: "Food & Beverage",
    hospital: "Healthcare",
    doctor: "Healthcare",
    pharmacy: "Healthcare",
    dentist: "Healthcare",
    school: "Education",
    university: "Education",
    gym: "Fitness",
    spa: "Wellness",
    store: "Retail",
    clothing_store: "Retail",
    shopping_mall: "Retail",
    bank: "Finance",
    finance: "Finance",
    accounting: "Finance",
    real_estate_agency: "Real Estate",
    car_dealer: "Automotive",
    car_repair: "Automotive",
    hotel: "Hospitality",
    lodging: "Hospitality",
    lawyer: "Legal",
    travel_agency: "Travel",
    beauty_salon: "Beauty",
    hair_care: "Beauty",
    electronics_store: "Technology",
    insurance_agency: "Finance",
  };
  for (const t of types) {
    if (map[t]) return map[t];
  }
  return "Business";
}

function scorePlace(place: PlaceResult): number {
  let score = 30;
  if (place.formatted_phone_number || place.international_phone_number) score += 15;
  if (place.website) score += 15;
  if (place.rating && place.rating >= 4) score += 10;
  if (place.rating && place.rating >= 4.5) score += 5;
  if (place.user_ratings_total && place.user_ratings_total > 50) score += 5;
  if (place.user_ratings_total && place.user_ratings_total > 200) score += 10;
  if (place.opening_hours?.open_now) score += 5;
  return Math.min(score, 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// AI INSIGHT GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

async function generateAIInsight(
  place: PlaceResult,
  industry: string,
  priority: string,
  score: number,
  displayLocation: string,
  email: string | null
): Promise<string> {
  const phone =
    place.formatted_phone_number || place.international_phone_number || "";

  const baseSummary =
    `${place.name} is a ${priority.toLowerCase()}-priority ${industry} lead in ${displayLocation} (score: ${score}/100).` +
    (place.rating
      ? ` Rated ${place.rating}⭐ by ${(
          place.user_ratings_total || 0
        ).toLocaleString()} customers.`
      : "") +
    (place.website
      ? ` Website: ${place.website.replace(/https?:\/\//, "").split("/")[0]}.`
      : " No website — great cold outreach opportunity.") +
    (phone ? ` Phone available.` : " No phone listed.") +
    (email ? ` Suggested email: ${email}.` : "");

  if (!OPENAI_API_KEY) return baseSummary;

  try {
    const prompt = `You are a B2B sales analyst. Based on the following business info, write 2-3 sentences describing:
1. What services or work this company likely offers
2. Why they could be a good sales lead

Business Name: ${place.name}
Industry: ${industry}
Location: ${place.formatted_address || displayLocation}
Google Types: ${(place.types || []).join(", ")}
Rating: ${place.rating || "N/A"} (${place.user_ratings_total || 0} reviews)
Has Website: ${place.website ? "Yes" : "No"}
Has Phone: ${phone ? "Yes" : "No"}

Write ONLY 2-3 short sentences. No bullet points. Be specific about likely services. Do not mention the score.`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 120,
        temperature: 0.7,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await res.json();
    const aiText = data.choices?.[0]?.message?.content?.trim() || "";

    if (!aiText) return baseSummary;

    return (
      `${aiText}\n\n📊 Score: ${score}/100 · Priority: ${priority}` +
      (place.rating
        ? ` · ⭐ ${place.rating} (${(
            place.user_ratings_total || 0
          ).toLocaleString()} reviews)`
        : "") +
      (phone ? ` · 📞 Phone available` : " · No phone listed") +
      (email ? ` · 📧 ${email}` : "")
    );
  } catch (err) {
    console.error("AI insight generation failed:", err);
    return baseSummary;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN POST HANDLER
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    if (!GOOGLE_API_KEY) {
      return NextResponse.json(
        { error: "GOOGLE_PLACES_API_KEY missing in .env", leads: [] },
        { status: 500 }
      );
    }

    const {
      industry,
      location,
      keyword,
      email: userEmail,
      bypassCache = false, // pass { bypassCache: true } to force fresh results
    } = await req.json();

    const hasInput = keyword || industry || location;
    if (!hasInput) {
      return NextResponse.json(
        { error: "Provide at least a location or keyword", leads: [] },
        { status: 400 }
      );
    }

    // ── Step 1: AI query parsing ──────────────────────────────────────────────
    const { searchQuery, extractedLocation } = await parseUserQuery(
      keyword || "",
      industry || "",
      location || ""
    );

    console.log("🔎 Final search query:", searchQuery);

    const cacheKey = toCacheKey(searchQuery);
    const displayLocation = extractedLocation || location || "this area";

    // ── Step 2: Cache lookup (skip if bypassCache flag set) ───────────────────
    if (!bypassCache) {
      // Layer 1 — memory
      const memHit = readMemoryCache(cacheKey);
      if (memHit) {
        return NextResponse.json({
          leads: memHit,
          total: memHit.length,
          fromCache: true,
          cacheLayer: "memory",
        });
      }

      // Layer 2 — database
      const dbHit = await readDBCache(cacheKey);
      if (dbHit) {
        // Warm memory cache for next request
        writeMemoryCache(cacheKey, dbHit, displayLocation);
        return NextResponse.json({
          leads: dbHit,
          total: dbHit.length,
          fromCache: true,
          cacheLayer: "database",
        });
      }
    } else {
      console.log("🔄 Cache bypassed — fetching fresh results");
    }

    // ── Step 3: Cache MISS → call Google Places API ───────────────────────────
    const places = await searchPlaces(searchQuery);
    if (!places.length) {
      return NextResponse.json({
        leads: [],
        total: 0,
        fromCache: false,
        message: "No results found",
      });
    }

    // ── Step 4: Build leads with AI insights ──────────────────────────────────
    const leads: LeadResult[] = await Promise.all(
      places.map(async (place) => {
        const score = scorePlace(place);
        const priority = score >= 70 ? "High" : score >= 45 ? "Medium" : "Low";
        const phone =
          place.formatted_phone_number ||
          place.international_phone_number ||
          "";
        const placeIndustry = inferIndustry(place.types || []);
        const email = guessEmail(place.website || "");

        const aiInsight = await generateAIInsight(
          place,
          placeIndustry,
          priority,
          score,
          displayLocation,
          email
        );

        return {
          placeId: place.place_id,
          company: place.name,
          address: place.formatted_address || "",
          phone,
          email,
          website: place.website || "",
          industry: placeIndustry,
          rating: place.rating || null,
          reviewCount: place.user_ratings_total || 0,
          score,
          priority,
          aiInsight,
          linkedinUrl: `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(
            place.name
          )}`,
          fromCache: false,
        };
      })
    );

    // ── Step 5: Write to both cache layers (fire-and-forget for DB) ───────────
    writeMemoryCache(cacheKey, leads, displayLocation);
    writeDBCache(cacheKey, leads, displayLocation).catch(() => {}); // non-blocking

    // ── Step 6: Auto-save new leads to DB ─────────────────────────────────────
    const user = userEmail
      ? await db.user.findUnique({ where: { email: userEmail } }).catch(() => null)
      : null;

    if (user) {
      for (const lead of leads) {
        try {
          const existing = await (db as any).lead
            .findFirst({ where: { placeId: lead.placeId } })
            .catch(() => null);
          if (!existing) {
            await (db as any).lead.create({
              data: {
                userId: user.id,
                company: lead.company,
                address: lead.address,
                phone: lead.phone || null,
                email: lead.email || null,
                website: lead.website || null,
                industry: lead.industry,
                score: lead.score,
                priority: lead.priority,
                aiInsights: lead.aiInsight,
                source: "google_maps",
                placeId: lead.placeId,
                linkedinUrl: lead.linkedinUrl,
                saved: false,
                status: "new",
              },
            });
          }
        } catch (_) {}
      }
    }

    return NextResponse.json({ leads, total: leads.length, fromCache: false });
  } catch (error: any) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: error.message, leads: [] },
      { status: 500 }
    );
  }
}