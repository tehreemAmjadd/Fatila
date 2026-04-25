// app/api/leads/search/route.ts
//
// KEY INSIGHT FROM LOGS: Google's next_page_token expires in ~5 minutes.
// Saving it to DB and using it later always fails with INVALID_REQUEST.
//
// SOLUTION: On first search, fetch ALL 3 pages IMMEDIATELY while the token
// is still fresh (within seconds). Cache all 60 results in DB.
// Subsequent searches just slice from the cached pool — no Google API needed.
//
// Page 2/3 tokens need ~2s to activate after page 1 response.
// We wait exactly 2s then retry up to 3 times before giving up on that page.
//
// Prisma model (nextPageToken field no longer needed but harmless if present):
//  model SearchCache {
//    id          String   @id @default(cuid())
//    cacheKey    String   @unique
//    leadsJson   String   @db.Text
//    location    String
//    createdAt   DateTime @default(now())
//    expiresAt   DateTime
//  }

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const GOOGLE_API_KEY =
  process.env.GOOGLE_PLACES_API_KEY ||
  process.env.GOOGLE_MAPS ||
  process.env.NEXT_PUBLIC_GOOGLE_MAPS ||
  "";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

const MEMORY_CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const DB_CACHE_TTL_HOURS  = 48;
const RESULTS_PER_PAGE    = 20;

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Memory cache ─────────────────────────────────────────────────────────────

interface MemEntry { leads: LeadResult[]; expiresAt: number }
const mem = new Map<string, MemEntry>();

function toCacheKey(q: string) {
  return q.toLowerCase().trim().replace(/\s+/g, " ");
}

function memRead(key: string): LeadResult[] | null {
  const e = mem.get(key);
  if (!e) return null;
  if (Date.now() > e.expiresAt) { mem.delete(key); return null; }
  console.log(`MEM HIT: "${key}" (${e.leads.length} leads)`);
  return e.leads;
}

function memWrite(key: string, leads: LeadResult[]) {
  mem.set(key, { leads, expiresAt: Date.now() + MEMORY_CACHE_TTL_MS });
}

// ─── DB cache ─────────────────────────────────────────────────────────────────

async function dbRead(key: string): Promise<LeadResult[] | null> {
  try {
    const row = await (db as any).searchCache.findUnique({ where: { cacheKey: key } });
    if (!row) return null;
    if (new Date() > new Date(row.expiresAt)) {
      (db as any).searchCache.delete({ where: { cacheKey: key } }).catch(() => {});
      return null;
    }
    const leads = JSON.parse(row.leadsJson) as LeadResult[];
    console.log(`DB HIT: "${key}" (${leads.length} leads)`);
    return leads;
  } catch (e) { console.error("DB read error:", e); return null; }
}

async function dbWrite(key: string, leads: LeadResult[], location: string) {
  try {
    const expiresAt = new Date(Date.now() + DB_CACHE_TTL_HOURS * 3600 * 1000);
    await (db as any).searchCache.upsert({
      where:  { cacheKey: key },
      update: { leadsJson: JSON.stringify(leads), location, expiresAt },
      create: { cacheKey: key, leadsJson: JSON.stringify(leads), location, expiresAt },
    });
    console.log(`DB WRITE: ${leads.length} leads saved`);
  } catch (e) { console.error("DB write error:", e); }
}

// ─── Google Places: fetch all pages while tokens are fresh ───────────────────

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function getDetails(placeId: string): Promise<PlaceResult | null> {
  const fields = "place_id,name,formatted_address,formatted_phone_number,international_phone_number,website,rating,user_ratings_total,types,opening_hours";
  try {
    const r = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${GOOGLE_API_KEY}`,
      { cache: "no-store" }
    );
    const d = await r.json();
    return d.status === "OK" ? d.result : null;
  } catch { return null; }
}

/**
 * Fetch a page using a pagetoken. Token needs ~2s to activate.
 * Retry up to 4 times with 2s gaps = max 8s wait.
 * MUST be called immediately after receiving the token (within 5 min expiry).
 */
async function fetchPageByToken(token: string): Promise<{ placeIds: string[]; nextToken: string | null }> {
  for (let i = 1; i <= 4; i++) {
    await sleep(2000); // wait for token to activate
    const url  = `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${encodeURIComponent(token)}&key=${GOOGLE_API_KEY}`;
    const res  = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    console.log(`  Token attempt ${i}: status=${data.status} results=${data.results?.length ?? 0}`);
    if (data.status === "OK" && data.results?.length) {
      return {
        placeIds: data.results.map((r: any) => r.place_id).filter(Boolean),
        nextToken: data.next_page_token ?? null,
      };
    }
    if (data.status !== "INVALID_REQUEST") break; // e.g. ZERO_RESULTS — stop
  }
  return { placeIds: [], nextToken: null };
}

/**
 * Fetch ALL available Google Places results in one go.
 * All page fetches happen immediately while tokens are fresh.
 * Returns up to 60 place IDs.
 */
async function fetchAllPlaceIdsNow(query: string): Promise<string[]> {
  const allIds: string[] = [];

  // Page 1
  const url1  = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}`;
  console.log(`Google page 1: "${query}"`);
  const res1  = await fetch(url1, { cache: "no-store" });
  const data1 = await res1.json();
  console.log(`Page 1: status=${data1.status} results=${data1.results?.length ?? 0} hasToken=${!!data1.next_page_token}`);

  if (data1.status !== "OK" || !data1.results?.length) return allIds;
  for (const r of data1.results) if (r.place_id) allIds.push(r.place_id);

  const token1 = data1.next_page_token;
  if (!token1) { console.log("No page 2 token"); return allIds; }

  // Page 2 — use token immediately while it's fresh
  console.log("Fetching page 2...");
  const { placeIds: ids2, nextToken: token2 } = await fetchPageByToken(token1);
  for (const id of ids2) if (!allIds.includes(id)) allIds.push(id);
  console.log(`Page 2: got ${ids2.length} results`);

  if (!token2) { console.log("No page 3 token"); return allIds; }

  // Page 3 — use token immediately
  console.log("Fetching page 3...");
  const { placeIds: ids3 } = await fetchPageByToken(token2);
  for (const id of ids3) if (!allIds.includes(id)) allIds.push(id);
  console.log(`Page 3: got ${ids3.length} results`);

  console.log(`Total place IDs: ${allIds.length}`);
  return allIds;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function guessEmail(website: string): string | null {
  if (!website) return null;
  try { return "info@" + website.replace(/https?:\/\//, "").split("/")[0].replace(/^www\./, ""); }
  catch { return null; }
}

function inferIndustry(types: string[]): string {
  const map: Record<string, string> = {
    restaurant:"Food & Beverage", food:"Food & Beverage", cafe:"Food & Beverage",
    hospital:"Healthcare", doctor:"Healthcare", pharmacy:"Healthcare", dentist:"Healthcare",
    school:"Education", university:"Education", gym:"Fitness", spa:"Wellness",
    store:"Retail", clothing_store:"Retail", shopping_mall:"Retail",
    bank:"Finance", finance:"Finance", accounting:"Finance",
    real_estate_agency:"Real Estate", car_dealer:"Automotive", car_repair:"Automotive",
    hotel:"Hospitality", lodging:"Hospitality", lawyer:"Legal", travel_agency:"Travel",
    beauty_salon:"Beauty", hair_care:"Beauty", electronics_store:"Technology",
    insurance_agency:"Finance",
  };
  for (const t of types) if (map[t]) return map[t];
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
    (place.website ? ` Website: ${place.website.replace(/https?:\/\//, "").split("/")[0]}.` : " No website — great cold outreach opportunity.") +
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
Business: ${place.name} | Industry: ${industry} | Location: ${place.formatted_address||loc}
Types: ${(place.types||[]).join(", ")} | Rating: ${place.rating||"N/A"} (${place.user_ratings_total||0} reviews)
Has Website: ${place.website?"Yes":"No"} | Has Phone: ${phone?"Yes":"No"}` }],
      }),
    });
    const d    = await res.json();
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
      const ind      = inferIndustry(p.types||[]);
      const email    = guessEmail(p.website||"");
      const insight  = await generateAIInsight(p, ind, priority, score, loc, email);
      return {
        placeId: p.place_id, company: p.name, address: p.formatted_address||"",
        phone, email, website: p.website||"", industry: ind,
        rating: p.rating||null, reviewCount: p.user_ratings_total||0,
        score, priority, aiInsight: insight,
        linkedinUrl: `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(p.name)}`,
        fromCache: false,
      };
    }));
    out.push(...batch);
  }
  return out;
}

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
        model: "gpt-4o-mini", max_tokens: 100,
        messages: [{ role: "user", content:
          `Short Google Places query (3-6 words) for: keyword="${keyword}" industry="${industry}" location="${location}". Reply ONLY as JSON: {"searchQuery":"...","location":"..."}` }],
      }),
    });
    const d = await res.json();
    const p = JSON.parse(d.choices?.[0]?.message?.content?.replace(/```json|```/g,"").trim()||"{}");
    return { searchQuery: p.searchQuery||parts.join(" "), extractedLocation: p.location||location };
  } catch { return { searchQuery: parts.join(" "), extractedLocation: location }; }
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

    console.log(`\n=== SEARCH: "${searchQuery}" | excluded=${excludeSet.size} ===`);

    // ── Load pool from cache ──────────────────────────────────────────────────
    let pool = memRead(cacheKey);
    if (!pool) {
      pool = await dbRead(cacheKey);
      if (pool) memWrite(cacheKey, pool);
    }

    // ── If cache exists: return next unseen batch ────────────────────────────
    if (pool && pool.length > 0) {
      const unseen = pool.filter(l => !excludeSet.has(l.placeId));
      console.log(`Pool: ${pool.length} | Unseen: ${unseen.length}`);

      if (unseen.length > 0) {
        const toReturn = unseen.slice(0, RESULTS_PER_PAGE);
        console.log(`Returning ${toReturn.length} from cache`);
        return NextResponse.json({
          leads: toReturn,
          total: toReturn.length,
          totalInPool: pool.length,
          remainingUnseen: unseen.length - toReturn.length,
        });
      }

      // All cached leads seen — nothing more to show
      console.log("All cached leads seen, pool exhausted");
      return NextResponse.json({
        leads: [], total: 0, totalInPool: pool.length, exhausted: true,
        message: "You've seen all available leads for this search. Try a different keyword or location.",
      });
    }

    // ── No cache: fetch ALL pages from Google RIGHT NOW ───────────────────────
    // All 3 pages fetched immediately so tokens don't expire
    console.log("No cache — fetching all Google pages now...");

    const allPlaceIds = await fetchAllPlaceIdsNow(searchQuery);

    if (!allPlaceIds.length) {
      return NextResponse.json({ leads: [], total: 0, message: "No results found for this search." });
    }

    // Fetch details for all collected places in parallel
    console.log(`Fetching details for ${allPlaceIds.length} places...`);
    const details = await Promise.all(allPlaceIds.map(id => getDetails(id)));
    const places  = details.filter(Boolean) as PlaceResult[];

    // Build leads with AI insights
    console.log(`Building leads for ${places.length} places...`);
    const allLeads = await buildLeads(places, displayLoc);
    console.log(`Built ${allLeads.length} total leads`);

    // Save full pool to cache
    memWrite(cacheKey, allLeads);
    dbWrite(cacheKey, allLeads, displayLoc).catch(() => {});
    if (userEmail) saveLeadsToDB(allLeads, userEmail).catch(() => {});

    // Return first batch
    const unseen   = allLeads.filter(l => !excludeSet.has(l.placeId));
    const toReturn = unseen.slice(0, RESULTS_PER_PAGE);

    console.log(`Returning first ${toReturn.length} of ${allLeads.length} total leads`);

    return NextResponse.json({
      leads: toReturn,
      total: toReturn.length,
      totalInPool: allLeads.length,
      remainingUnseen: unseen.length - toReturn.length,
    });

  } catch (error: any) {
    console.error("Search error:", error);
    return NextResponse.json({ error: error.message, leads: [] }, { status: 500 });
  }
}