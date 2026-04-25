// app/api/leads/search/route.ts
//
// PAGINATION STRATEGY:
// On first search: fetch ALL available Google pages (up to 3 = 60 results)
// synchronously using token polling. Cache all 60. Return first 20 unseen.
// On repeat search: serve next 20 from cache. No extra Google API calls.
//
// Prisma schema (add nextPageToken field if not already present):
//  model SearchCache {
//    id            String   @id @default(cuid())
//    cacheKey      String   @unique
//    leadsJson     String   @db.Text
//    nextPageToken String?  @db.Text
//    location      String
//    createdAt     DateTime @default(now())
//    expiresAt     DateTime
//  }

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const GOOGLE_API_KEY =
  process.env.GOOGLE_PLACES_API_KEY ||
  process.env.GOOGLE_MAPS ||
  process.env.NEXT_PUBLIC_GOOGLE_MAPS ||
  "";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

const MEMORY_CACHE_TTL_MS = 30 * 60 * 1000;
const DB_CACHE_TTL_HOURS  = 24;
const RESULTS_PER_PAGE    = 20; // how many leads to show per search click

// ─── Types ───────────────────────────────────────────────────────────────────

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

interface CacheEntry {
  leads: LeadResult[];
  location: string;
  expiresAt: number;
}

// ─── In-memory cache ──────────────────────────────────────────────────────────

const memoryCache = new Map<string, CacheEntry>();

function toCacheKey(q: string) {
  return q.toLowerCase().trim().replace(/\s+/g, " ");
}

function readMemoryCache(key: string): LeadResult[] | null {
  const e = memoryCache.get(key);
  if (!e) return null;
  if (Date.now() > e.expiresAt) { memoryCache.delete(key); return null; }
  console.log(`Memory cache HIT: "${key}" (${e.leads.length} leads)`);
  return e.leads;
}

function writeMemoryCache(key: string, leads: LeadResult[], location: string) {
  memoryCache.set(key, { leads, location, expiresAt: Date.now() + MEMORY_CACHE_TTL_MS });
}

// ─── DB cache ─────────────────────────────────────────────────────────────────

async function readDBCache(key: string): Promise<LeadResult[] | null> {
  try {
    const row = await (db as any).searchCache.findUnique({ where: { cacheKey: key } });
    if (!row) return null;
    if (new Date() > new Date(row.expiresAt)) {
      (db as any).searchCache.delete({ where: { cacheKey: key } }).catch(() => {});
      return null;
    }
    console.log(`DB cache HIT: "${key}"`);
    return JSON.parse(row.leadsJson) as LeadResult[];
  } catch { return null; }
}

async function writeDBCache(key: string, leads: LeadResult[], location: string) {
  try {
    const expiresAt = new Date(Date.now() + DB_CACHE_TTL_HOURS * 3600 * 1000);
    await (db as any).searchCache.upsert({
      where: { cacheKey: key },
      update: { leadsJson: JSON.stringify(leads), location, expiresAt },
      create: { cacheKey: key, leadsJson: JSON.stringify(leads), location, expiresAt },
    });
  } catch {}
}

// ─── AI Query Parser ──────────────────────────────────────────────────────────

async function parseUserQuery(keyword: string, industry: string, location: string) {
  const parts = [keyword, industry, location].filter(Boolean);
  if (!OPENAI_API_KEY || keyword.trim().split(/\s+/).length <= 4) {
    return { searchQuery: parts.join(" "), extractedLocation: location };
  }
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o-mini", max_tokens: 150,
        messages: [{ role: "user", content:
          `Convert to a short Google Places query (3-6 words).
Keyword: "${keyword}" | Industry: "${industry}" | Location: "${location}"
Reply ONLY as JSON: {"searchQuery":"...","location":"..."}` }],
      }),
    });
    const d = await res.json();
    const parsed = JSON.parse(d.choices?.[0]?.message?.content?.replace(/```json|```/g,"").trim() || "{}");
    return { searchQuery: parsed.searchQuery || parts.join(" "), extractedLocation: parsed.location || location };
  } catch {
    return { searchQuery: parts.join(" "), extractedLocation: location };
  }
}

// ─── Google Places: fetch ALL pages upfront ───────────────────────────────────

async function getPlaceDetails(placeId: string): Promise<PlaceResult | null> {
  const fields = "place_id,name,formatted_address,formatted_phone_number,international_phone_number,website,rating,user_ratings_total,types,opening_hours";
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${GOOGLE_API_KEY}`,
      { cache: "no-store" }
    );
    const d = await res.json();
    return d.status === "OK" ? d.result : null;
  } catch { return null; }
}

/**
 * Poll for a pagetoken to become valid.
 * Google says token is valid "shortly after" the previous response —
 * typically 2-3 seconds. We retry up to 5 times with 2s gaps.
 */
async function fetchPageWithToken(token: string): Promise<{ placeIds: string[]; nextToken: string | null }> {
  const MAX_RETRIES = 5;
  const RETRY_DELAY = 2000;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    // Always wait before using a pagetoken
    await new Promise(r => setTimeout(r, RETRY_DELAY));

    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${encodeURIComponent(token)}&key=${GOOGLE_API_KEY}`;
    const res  = await fetch(url, { cache: "no-store" });
    const data = await res.json();

    console.log(`Pagetoken attempt ${attempt}: status=${data.status} results=${data.results?.length ?? 0}`);

    if (data.status === "OK" && data.results?.length) {
      return {
        placeIds: data.results.map((r: any) => r.place_id).filter(Boolean),
        nextToken: data.next_page_token ?? null,
      };
    }

    if (data.status === "INVALID_REQUEST") {
      // Token not ready yet — retry
      console.log("Token not ready, retrying...");
      continue;
    }

    // Any other status (ZERO_RESULTS, etc.) — stop
    break;
  }

  return { placeIds: [], nextToken: null };
}

/**
 * Fetch ALL available Google Places results for a query.
 * Returns up to 60 place IDs (3 pages × 20).
 */
async function fetchAllPlaceIds(query: string): Promise<string[]> {
  const allIds: string[] = [];

  // Page 1
  const url1 = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}`;
  console.log(`Google Places page 1: "${query}"`);
  const res1  = await fetch(url1, { cache: "no-store" });
  const data1 = await res1.json();

  console.log(`Page 1: status=${data1.status} results=${data1.results?.length ?? 0} hasToken=${!!data1.next_page_token}`);

  if (data1.status !== "OK" || !data1.results?.length) return allIds;

  for (const r of data1.results) { if (r.place_id) allIds.push(r.place_id); }

  let nextToken: string | null = data1.next_page_token ?? null;

  // Page 2
  if (nextToken) {
    console.log("Fetching page 2...");
    const p2 = await fetchPageWithToken(nextToken);
    for (const id of p2.placeIds) { if (!allIds.includes(id)) allIds.push(id); }
    nextToken = p2.nextToken;

    // Page 3
    if (nextToken) {
      console.log("Fetching page 3...");
      const p3 = await fetchPageWithToken(nextToken);
      for (const id of p3.placeIds) { if (!allIds.includes(id)) allIds.push(id); }
    }
  }

  console.log(`Total place IDs collected: ${allIds.length}`);
  return allIds;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function guessEmail(website: string): string | null {
  if (!website) return null;
  try { return "info@" + website.replace(/https?:\/\//, "").split("/")[0].replace(/^www\./, ""); }
  catch { return null; }
}

function inferIndustry(types: string[]): string {
  const map: Record<string,string> = {
    restaurant:"Food & Beverage", food:"Food & Beverage", cafe:"Food & Beverage",
    hospital:"Healthcare", doctor:"Healthcare", pharmacy:"Healthcare", dentist:"Healthcare",
    school:"Education", university:"Education", gym:"Fitness", spa:"Wellness",
    store:"Retail", clothing_store:"Retail", shopping_mall:"Retail",
    bank:"Finance", finance:"Finance", accounting:"Finance",
    real_estate_agency:"Real Estate", car_dealer:"Automotive", car_repair:"Automotive",
    hotel:"Hospitality", lodging:"Hospitality", lawyer:"Legal", travel_agency:"Travel",
    beauty_salon:"Beauty", hair_care:"Beauty", electronics_store:"Technology", insurance_agency:"Finance",
  };
  for (const t of types) { if (map[t]) return map[t]; }
  return "Business";
}

function scorePlace(p: PlaceResult): number {
  let s = 30;
  if (p.formatted_phone_number || p.international_phone_number) s += 15;
  if (p.website) s += 15;
  if (p.rating && p.rating >= 4)   s += 10;
  if (p.rating && p.rating >= 4.5) s += 5;
  if (p.user_ratings_total && p.user_ratings_total > 50)  s += 5;
  if (p.user_ratings_total && p.user_ratings_total > 200) s += 10;
  if (p.opening_hours?.open_now) s += 5;
  return Math.min(s, 100);
}

async function generateAIInsight(
  place: PlaceResult, industry: string, priority: string,
  score: number, loc: string, email: string | null
): Promise<string> {
  const phone = place.formatted_phone_number || place.international_phone_number || "";
  const base =
    `${place.name} is a ${priority.toLowerCase()}-priority ${industry} lead in ${loc} (score: ${score}/100).` +
    (place.rating ? ` Rated ${place.rating}⭐ by ${(place.user_ratings_total||0).toLocaleString()} customers.` : "") +
    (place.website ? ` Website: ${place.website.replace(/https?:\/\//,"").split("/")[0]}.` : " No website — great cold outreach opportunity.") +
    (phone ? " Phone available." : " No phone listed.") +
    (email ? ` Suggested email: ${email}.` : "");

  if (!OPENAI_API_KEY) return base;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o-mini", max_tokens: 120, temperature: 0.7,
        messages: [{ role: "user", content:
          `B2B analyst: 2-3 sentences on why this is a good lead (no bullets, no score):
Business: ${place.name} | Industry: ${industry} | Location: ${place.formatted_address || loc}
Types: ${(place.types||[]).join(", ")} | Rating: ${place.rating||"N/A"} (${place.user_ratings_total||0} reviews)
Has Website: ${place.website?"Yes":"No"} | Has Phone: ${phone?"Yes":"No"}` }],
      }),
    });
    const d = await res.json();
    const text = d.choices?.[0]?.message?.content?.trim() || "";
    if (!text) return base;
    return `${text}\n\n📊 Score: ${score}/100 · Priority: ${priority}` +
      (place.rating ? ` · ⭐ ${place.rating} (${(place.user_ratings_total||0).toLocaleString()} reviews)` : "") +
      (phone ? " · 📞 Phone available" : " · No phone listed") +
      (email ? ` · 📧 ${email}` : "");
  } catch { return base; }
}

async function buildLeads(places: PlaceResult[], loc: string): Promise<LeadResult[]> {
  const out: LeadResult[] = [];
  for (let i = 0; i < places.length; i += 10) {
    const batch = await Promise.all(places.slice(i, i+10).map(async p => {
      const score    = scorePlace(p);
      const priority = score >= 70 ? "High" : score >= 45 ? "Medium" : "Low";
      const phone    = p.formatted_phone_number || p.international_phone_number || "";
      const ind      = inferIndustry(p.types || []);
      const email    = guessEmail(p.website || "");
      const insight  = await generateAIInsight(p, ind, priority, score, loc, email);
      return {
        placeId: p.place_id, company: p.name, address: p.formatted_address || "",
        phone, email, website: p.website || "", industry: ind,
        rating: p.rating || null, reviewCount: p.user_ratings_total || 0,
        score, priority, aiInsight: insight,
        linkedinUrl: `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(p.name)}`,
        fromCache: false,
      };
    }));
    out.push(...batch);
  }
  return out;
}

async function saveLeadsToDB(leads: LeadResult[], userEmail: string) {
  try {
    const user = await db.user.findUnique({ where: { email: userEmail } }).catch(() => null);
    if (!user) return;
    for (const lead of leads) {
      try {
        const exists = await (db as any).lead.findFirst({ where: { placeId: lead.placeId } }).catch(() => null);
        if (!exists) {
          await (db as any).lead.create({
            data: {
              userId: user.id, company: lead.company, address: lead.address,
              phone: lead.phone||null, email: lead.email||null, website: lead.website||null,
              industry: lead.industry, score: lead.score, priority: lead.priority,
              aiInsights: lead.aiInsight, source: "google_maps", placeId: lead.placeId,
              linkedinUrl: lead.linkedinUrl, saved: false, status: "new",
            },
          });
        }
      } catch {}
    }
  } catch {}
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    if (!GOOGLE_API_KEY) {
      return NextResponse.json({ error: "GOOGLE_PLACES_API_KEY missing", leads: [] }, { status: 500 });
    }

    const {
      industry = "", location = "", keyword = "",
      email: userEmail = "",
      excludePlaceIds = [] as string[],
    } = await req.json();

    if (!keyword && !industry && !location) {
      return NextResponse.json({ error: "Provide at least a location or keyword", leads: [] }, { status: 400 });
    }

    const { searchQuery, extractedLocation } = await parseUserQuery(keyword, industry, location);
    const cacheKey   = toCacheKey(searchQuery);
    const displayLoc = extractedLocation || location || "this area";
    const excludeSet = new Set<string>(excludePlaceIds);

    // ── Load full pool from cache ─────────────────────────────────────────────
    let pool: LeadResult[] | null = readMemoryCache(cacheKey);

    if (!pool) {
      pool = await readDBCache(cacheKey);
      if (pool) writeMemoryCache(cacheKey, pool, displayLoc);
    }

    // ── If no cache: fetch ALL pages from Google now ──────────────────────────
    if (!pool) {
      console.log("Cache miss — fetching all pages from Google...");

      const allPlaceIds = await fetchAllPlaceIds(searchQuery);

      if (!allPlaceIds.length) {
        return NextResponse.json({ leads: [], total: 0, message: "No results found" });
      }

      // Fetch details for ALL collected place IDs
      const details = await Promise.all(allPlaceIds.map(id => getPlaceDetails(id)));
      const places  = details.filter(Boolean) as PlaceResult[];

      pool = await buildLeads(places, displayLoc);
      console.log(`Built ${pool.length} leads total from ${places.length} places`);

      // Cache the full pool
      writeMemoryCache(cacheKey, pool, displayLoc);
      writeDBCache(cacheKey, pool, displayLoc).catch(() => {});

      // Save to DB
      if (userEmail) saveLeadsToDB(pool, userEmail).catch(() => {});
    }

    // ── Filter: only return leads user hasn't seen yet ────────────────────────
    const unseen = pool.filter(l => !excludeSet.has(l.placeId));

    console.log(`Pool: ${pool.length} | Already seen: ${excludeSet.size} | Unseen: ${unseen.length}`);

    if (unseen.length === 0) {
      return NextResponse.json({
        leads: [],
        total: 0,
        totalInPool: pool.length,
        exhausted: true,
        message: "You've seen all available leads for this search. Try a different keyword or location.",
      });
    }

    // Return next batch of unseen leads
    const toReturn = unseen.slice(0, RESULTS_PER_PAGE);

    return NextResponse.json({
      leads: toReturn,
      total: toReturn.length,
      totalInPool: pool.length,
      remainingUnseen: unseen.length - toReturn.length,
      fromCache: true,
    });

  } catch (error: any) {
    console.error("Search error:", error);
    return NextResponse.json({ error: error.message, leads: [] }, { status: 500 });
  }
}