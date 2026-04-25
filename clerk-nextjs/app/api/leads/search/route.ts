// app/api/leads/search/route.ts
// Fixed: Google Places pagination (up to 60 results) + user-specific filtering
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
//  Cache stores ALL paginated results (up to 60) per search query.
//  Per-user filtering happens at response time using excludePlaceIds.
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

// Google Places allows max 3 pages x 20 results = 60 results per query
const MAX_PAGES = 3;
// Google requires ~2s delay before next_page_token becomes valid
const PAGE_DELAY_MS = 2000;

interface CacheEntry {
  leads: LeadResult[];
  location: string;
  expiresAt: number;
}

const memoryCache = new Map<string, CacheEntry>();

function toCacheKey(query: string): string {
  return query.toLowerCase().trim().replace(/\s+/g, " ");
}

function readMemoryCache(key: string): LeadResult[] | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  console.log("Cache HIT (memory):", key, `(${entry.leads.length} leads)`);
  return entry.leads;
}

function writeMemoryCache(key: string, leads: LeadResult[], location: string): void {
  memoryCache.set(key, { leads, location, expiresAt: Date.now() + MEMORY_CACHE_TTL_MS });
}

async function readDBCache(key: string): Promise<LeadResult[] | null> {
  try {
    const row = await (db as any).searchCache.findUnique({ where: { cacheKey: key } });
    if (!row) return null;
    if (new Date() > new Date(row.expiresAt)) {
      (db as any).searchCache.delete({ where: { cacheKey: key } }).catch(() => {});
      return null;
    }
    console.log("Cache HIT (database):", key);
    return JSON.parse(row.leadsJson) as LeadResult[];
  } catch {
    return null;
  }
}

async function writeDBCache(key: string, leads: LeadResult[], location: string): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + DB_CACHE_TTL_HOURS * 60 * 60 * 1000);
    await (db as any).searchCache.upsert({
      where: { cacheKey: key },
      update: { leadsJson: JSON.stringify(leads), location, expiresAt },
      create: { cacheKey: key, leadsJson: JSON.stringify(leads), location, expiresAt },
    });
  } catch {}
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
  fromCache?: boolean;
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
  const isSimple = wordCount <= 4 && !keyword.includes("?") && !keyword.includes(",");

  if (isSimple || !OPENAI_API_KEY) {
    const parts = [keyword, industry, location].filter(Boolean);
    return { searchQuery: parts.join(" "), extractedLocation: location };
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 200,
        messages: [{
          role: "user",
          content: `You are a lead generation assistant. A user typed this search query:
"${keyword}"
${industry ? `They also selected industry: "${industry}"` : ""}
${location ? `They also typed location: "${location}"` : ""}

Extract from this the best Google Places search query (3-6 words max, like "software companies Lahore" or "dental clinics Dubai").
Also extract the city/location mentioned.

Reply ONLY with valid JSON, no explanation:
{"searchQuery": "...", "location": "..."}`
        }],
      }),
    });
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "";
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    return {
      searchQuery: parsed.searchQuery || [keyword, industry, location].filter(Boolean).join(" "),
      extractedLocation: parsed.location || location,
    };
  } catch {
    return { searchQuery: [keyword, industry, location].filter(Boolean).join(" "), extractedLocation: location };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE PLACES — paginated fetch (up to 3 pages = 60 results)
// ─────────────────────────────────────────────────────────────────────────────

async function getPlaceDetails(placeId: string): Promise<PlaceResult | null> {
  const fields = "place_id,name,formatted_address,formatted_phone_number,international_phone_number,website,rating,user_ratings_total,types,opening_hours";
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${GOOGLE_API_KEY}`,
      { cache: "no-store" }
    );
    const data = await res.json();
    return data.status === "OK" ? data.result : null;
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetches ALL available Google Places results using pagination.
 * Google Places Text Search returns up to 20 results per page and
 * provides next_page_token for additional pages (max 3 pages = 60 results).
 * A 2-second delay is required between paginated requests.
 */
async function searchPlacesAllPages(query: string): Promise<PlaceResult[]> {
  const allPlaceIds: string[] = [];
  let pageToken: string | undefined;
  let pageNum = 0;

  while (pageNum < MAX_PAGES) {
    let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?key=${GOOGLE_API_KEY}`;

    if (pageNum === 0) {
      url += `&query=${encodeURIComponent(query)}`;
      console.log(`Google Places page 1: "${query}"`);
    } else {
      if (!pageToken) break;
      // Must wait before pagetoken becomes usable
      await sleep(PAGE_DELAY_MS);
      url += `&pagetoken=${pageToken}`;
      console.log(`Google Places page ${pageNum + 1}: pagetoken`);
    }

    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();

    console.log(`Page ${pageNum + 1} status: ${data.status} | results: ${data.results?.length ?? 0}`);

    if (data.status !== "OK" || !data.results?.length) break;

    for (const r of data.results) {
      if (r.place_id && !allPlaceIds.includes(r.place_id)) {
        allPlaceIds.push(r.place_id);
      }
    }

    pageToken = data.next_page_token;
    pageNum++;

    if (!pageToken) {
      console.log(`No more pages after page ${pageNum}`);
      break;
    }
  }

  console.log(`Total place IDs collected across ${pageNum} page(s): ${allPlaceIds.length}`);

  // Fetch full details for all places in parallel
  const details = await Promise.all(allPlaceIds.map(id => getPlaceDetails(id)));
  return details.filter(Boolean) as PlaceResult[];
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function guessEmail(website: string): string | null {
  if (!website) return null;
  try {
    const domain = website.replace(/https?:\/\//, "").split("/")[0].replace(/^www\./, "");
    return `info@${domain}`;
  } catch {
    return null;
  }
}

function inferIndustry(types: string[]): string {
  const map: Record<string, string> = {
    restaurant: "Food & Beverage", food: "Food & Beverage", cafe: "Food & Beverage",
    hospital: "Healthcare", doctor: "Healthcare", pharmacy: "Healthcare", dentist: "Healthcare",
    school: "Education", university: "Education",
    gym: "Fitness", spa: "Wellness",
    store: "Retail", clothing_store: "Retail", shopping_mall: "Retail",
    bank: "Finance", finance: "Finance", accounting: "Finance",
    real_estate_agency: "Real Estate",
    car_dealer: "Automotive", car_repair: "Automotive",
    hotel: "Hospitality", lodging: "Hospitality",
    lawyer: "Legal", travel_agency: "Travel",
    beauty_salon: "Beauty", hair_care: "Beauty",
    electronics_store: "Technology", insurance_agency: "Finance",
  };
  for (const t of types) { if (map[t]) return map[t]; }
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
  place: PlaceResult, industry: string, priority: string,
  score: number, displayLocation: string, email: string | null
): Promise<string> {
  const phone = place.formatted_phone_number || place.international_phone_number || "";
  const baseSummary =
    `${place.name} is a ${priority.toLowerCase()}-priority ${industry} lead in ${displayLocation} (score: ${score}/100).` +
    (place.rating ? ` Rated ${place.rating}⭐ by ${(place.user_ratings_total || 0).toLocaleString()} customers.` : "") +
    (place.website ? ` Website: ${place.website.replace(/https?:\/\//, "").split("/")[0]}.` : " No website — great cold outreach opportunity.") +
    (phone ? ` Phone available.` : " No phone listed.") +
    (email ? ` Suggested email: ${email}.` : "");

  if (!OPENAI_API_KEY) return baseSummary;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o-mini", max_tokens: 120, temperature: 0.7,
        messages: [{
          role: "user",
          content: `You are a B2B sales analyst. Write 2-3 sentences about why this is a good lead:
Business: ${place.name} | Industry: ${industry} | Location: ${place.formatted_address || displayLocation}
Types: ${(place.types || []).join(", ")} | Rating: ${place.rating || "N/A"} (${place.user_ratings_total || 0} reviews)
Has Website: ${place.website ? "Yes" : "No"} | Has Phone: ${phone ? "Yes" : "No"}
Write ONLY 2-3 short sentences. No bullet points. Be specific. Do not mention the score.`
        }],
      }),
    });
    const data = await res.json();
    const aiText = data.choices?.[0]?.message?.content?.trim() || "";
    if (!aiText) return baseSummary;
    return (
      `${aiText}\n\n📊 Score: ${score}/100 · Priority: ${priority}` +
      (place.rating ? ` · ⭐ ${place.rating} (${(place.user_ratings_total || 0).toLocaleString()} reviews)` : "") +
      (phone ? ` · 📞 Phone available` : " · No phone listed") +
      (email ? ` · 📧 ${email}` : "")
    );
  } catch {
    return baseSummary;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN POST HANDLER
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    if (!GOOGLE_API_KEY) {
      return NextResponse.json({ error: "GOOGLE_PLACES_API_KEY missing in .env", leads: [] }, { status: 500 });
    }

    const {
      industry, location, keyword,
      email: userEmail,
      bypassCache = false,
      excludePlaceIds = [] as string[],   // placeIds user already saw this session
    } = await req.json();

    if (!keyword && !industry && !location) {
      return NextResponse.json({ error: "Provide at least a location or keyword", leads: [] }, { status: 400 });
    }

    // ── Step 1: Parse query ───────────────────────────────────────────────────
    const { searchQuery, extractedLocation } = await parseUserQuery(keyword || "", industry || "", location || "");
    console.log("Final search query:", searchQuery);

    const cacheKey = toCacheKey(searchQuery);
    const displayLocation = extractedLocation || location || "this area";
    const excludeSet = new Set<string>(excludePlaceIds);

    // ── Step 2: Cache lookup ──────────────────────────────────────────────────
    let allLeads: LeadResult[] | null = null;
    let fromCache = false;

    if (!bypassCache) {
      const memHit = readMemoryCache(cacheKey);
      if (memHit) { allLeads = memHit; fromCache = true; }
      else {
        const dbHit = await readDBCache(cacheKey);
        if (dbHit) { writeMemoryCache(cacheKey, dbHit, displayLocation); allLeads = dbHit; fromCache = true; }
      }
    }

    // ── Step 3: Cache MISS → fetch all pages from Google ─────────────────────
    if (!allLeads) {
      const places = await searchPlacesAllPages(searchQuery);

      if (!places.length) {
        return NextResponse.json({ leads: [], total: 0, fromCache: false, message: "No results found" });
      }

      // Build leads in batches of 10 to keep things manageable
      const BATCH_SIZE = 10;
      const builtLeads: LeadResult[] = [];

      for (let i = 0; i < places.length; i += BATCH_SIZE) {
        const batch = places.slice(i, i + BATCH_SIZE);
        const batchLeads = await Promise.all(
          batch.map(async (place) => {
            const score = scorePlace(place);
            const priority = score >= 70 ? "High" : score >= 45 ? "Medium" : "Low";
            const phone = place.formatted_phone_number || place.international_phone_number || "";
            const placeIndustry = inferIndustry(place.types || []);
            const email = guessEmail(place.website || "");
            const aiInsight = await generateAIInsight(place, placeIndustry, priority, score, displayLocation, email);
            return {
              placeId: place.place_id, company: place.name,
              address: place.formatted_address || "", phone, email,
              website: place.website || "", industry: placeIndustry,
              rating: place.rating || null, reviewCount: place.user_ratings_total || 0,
              score, priority, aiInsight,
              linkedinUrl: `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(place.name)}`,
              fromCache: false,
            };
          })
        );
        builtLeads.push(...batchLeads);
      }

      allLeads = builtLeads;
      console.log(`Built ${allLeads.length} leads total`);

      // Write to both cache layers
      writeMemoryCache(cacheKey, allLeads, displayLocation);
      writeDBCache(cacheKey, allLeads, displayLocation).catch(() => {});

      // Auto-save to DB
      const user = userEmail
        ? await db.user.findUnique({ where: { email: userEmail } }).catch(() => null)
        : null;

      if (user) {
        for (const lead of allLeads) {
          try {
            const existing = await (db as any).lead.findFirst({ where: { placeId: lead.placeId } }).catch(() => null);
            if (!existing) {
              await (db as any).lead.create({
                data: {
                  userId: user.id, company: lead.company, address: lead.address,
                  phone: lead.phone || null, email: lead.email || null,
                  website: lead.website || null, industry: lead.industry,
                  score: lead.score, priority: lead.priority, aiInsights: lead.aiInsight,
                  source: "google_maps", placeId: lead.placeId,
                  linkedinUrl: lead.linkedinUrl, saved: false, status: "new",
                },
              });
            }
          } catch (_) {}
        }
      }
    }

    // ── Step 4: Filter out leads this user already saw ────────────────────────
    const filteredLeads = excludeSet.size > 0
      ? allLeads.filter(lead => !excludeSet.has(lead.placeId))
      : allLeads;

    console.log(`Pool: ${allLeads.length} | Excluded: ${excludeSet.size} | Returning: ${filteredLeads.length}`);

    return NextResponse.json({
      leads: filteredLeads,
      total: filteredLeads.length,
      totalInPool: allLeads.length,
      fromCache,
    });

  } catch (error: any) {
    console.error("Search error:", error);
    return NextResponse.json({ error: error.message, leads: [] }, { status: 500 });
  }
}