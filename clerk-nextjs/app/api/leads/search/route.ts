// app/api/leads/search/route.ts
//
// STRATEGY — one Google page per user request:
//
//  Search 1:  fetch page 1 (20 results) → save leads + next_page_token to DB
//             → return 20 leads
//  Search 2:  load DB cache (20 leads) → all 20 already seen
//             → token exists → fetch page 2 NOW (wait 2 s for token)
//             → append 20 more leads to cache → return next 20
//  Search 3:  same for page 3 (up to 60 total)
//  Search 4+: pool exhausted, tell user to try different keyword
//
// Prisma model — add nextPageToken field and run `npx prisma db push`:
//
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

const MEMORY_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const DB_CACHE_TTL_HOURS  = 48;
const BATCH_SIZE           = 20; // leads to return per search click

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

interface PoolEntry {
  leads: LeadResult[];
  nextPageToken: string | null;
  location: string;
}

// ─── In-memory cache ──────────────────────────────────────────────────────────

interface MemEntry extends PoolEntry { expiresAt: number }
const mem = new Map<string, MemEntry>();

function toCacheKey(q: string) {
  return q.toLowerCase().trim().replace(/\s+/g, " ");
}

function memRead(key: string): PoolEntry | null {
  const e = mem.get(key);
  if (!e) return null;
  if (Date.now() > e.expiresAt) { mem.delete(key); return null; }
  return e;
}

function memWrite(key: string, entry: PoolEntry) {
  mem.set(key, { ...entry, expiresAt: Date.now() + MEMORY_CACHE_TTL_MS });
}

// ─── DB cache ─────────────────────────────────────────────────────────────────

async function dbRead(key: string): Promise<PoolEntry | null> {
  try {
    const row = await (db as any).searchCache.findUnique({ where: { cacheKey: key } });
    if (!row) return null;
    if (new Date() > new Date(row.expiresAt)) {
      (db as any).searchCache.delete({ where: { cacheKey: key } }).catch(() => {});
      return null;
    }
    return {
      leads: JSON.parse(row.leadsJson) as LeadResult[],
      nextPageToken: row.nextPageToken ?? null,
      location: row.location,
    };
  } catch (e) {
    console.error("DB read error:", e);
    return null;
  }
}

async function dbWrite(key: string, entry: PoolEntry) {
  try {
    const expiresAt = new Date(Date.now() + DB_CACHE_TTL_HOURS * 3600 * 1000);
    await (db as any).searchCache.upsert({
      where:  { cacheKey: key },
      update: { leadsJson: JSON.stringify(entry.leads), nextPageToken: entry.nextPageToken, location: entry.location, expiresAt },
      create: { cacheKey: key, leadsJson: JSON.stringify(entry.leads), nextPageToken: entry.nextPageToken, location: entry.location, expiresAt },
    });
    console.log(`DB saved: ${entry.leads.length} leads, token=${!!entry.nextPageToken}`);
  } catch (e) {
    console.error("DB write error:", e);
  }
}

// ─── Google Places ────────────────────────────────────────────────────────────

async function getDetails(placeId: string): Promise<PlaceResult | null> {
  const fields = "place_id,name,formatted_address,formatted_phone_number,international_phone_number,website,rating,user_ratings_total,types,opening_hours";
  try {
    const r = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${GOOGLE_API_KEY}`, { cache: "no-store" });
    const d = await r.json();
    return d.status === "OK" ? d.result : null;
  } catch { return null; }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Fetch ONE page from Google Places.
 * - First page: pass `query`, leave `token` undefined
 * - Next pages:  pass `token` only (no query needed)
 *
 * For token pages we retry up to 6 times with 2.5 s gaps because
 * Google makes the token valid "shortly after" the prior response.
 */
async function fetchGooglePage(
  query: string,
  token?: string
): Promise<{ places: PlaceResult[]; nextToken: string | null }> {

  if (token) {
    // Retry loop until token becomes valid
    for (let attempt = 1; attempt <= 6; attempt++) {
      await sleep(2500); // must wait before each token use
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${encodeURIComponent(token)}&key=${GOOGLE_API_KEY}`;
      const res  = await fetch(url, { cache: "no-store" });
      const data = await res.json();

      console.log(`Token page attempt ${attempt}: status=${data.status} results=${data.results?.length ?? 0}`);

      if (data.status === "OK" && data.results?.length) {
        const details = await Promise.all(data.results.map((r: any) => getDetails(r.place_id)));
        return {
          places:    details.filter(Boolean) as PlaceResult[],
          nextToken: data.next_page_token ?? null,
        };
      }

      if (data.status === "INVALID_REQUEST") continue; // token not ready yet
      break; // ZERO_RESULTS or other — stop
    }
    return { places: [], nextToken: null };
  }

  // First page — use query param
  const url  = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}`;
  console.log(`Google Places page 1: "${query}"`);
  const res  = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  console.log(`Page 1: status=${data.status} results=${data.results?.length ?? 0} hasToken=${!!data.next_page_token}`);

  if (data.status !== "OK" || !data.results?.length) return { places: [], nextToken: null };

  const details = await Promise.all(data.results.map((r: any) => getDetails(r.place_id)));
  return {
    places:    details.filter(Boolean) as PlaceResult[],
    nextToken: data.next_page_token ?? null,
  };
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

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
    (place.rating ? ` Rated ${place.rating}⭐ by ${(place.user_ratings_total || 0).toLocaleString()} customers.` : "") +
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
Business: ${place.name} | Industry: ${industry} | Location: ${place.formatted_address || loc}
Types: ${(place.types || []).join(", ")} | Rating: ${place.rating || "N/A"} (${place.user_ratings_total || 0} reviews)
Has Website: ${place.website ? "Yes" : "No"} | Has Phone: ${phone ? "Yes" : "No"}` }],
      }),
    });
    const d    = await res.json();
    const text = d.choices?.[0]?.message?.content?.trim() || "";
    if (!text) return base;
    return `${text}\n\n📊 Score: ${score}/100 · Priority: ${priority}` +
      (place.rating ? ` · ⭐ ${place.rating} (${(place.user_ratings_total || 0).toLocaleString()} reviews)` : "") +
      (phone ? " · 📞 Phone available" : " · No phone listed") +
      (email ? ` · 📧 ${email}` : "");
  } catch { return base; }
}

async function buildLeads(places: PlaceResult[], loc: string): Promise<LeadResult[]> {
  const out: LeadResult[] = [];
  for (let i = 0; i < places.length; i += 10) {
    const batch = await Promise.all(places.slice(i, i + 10).map(async p => {
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
    const parsed = JSON.parse(d.choices?.[0]?.message?.content?.replace(/```json|```/g, "").trim() || "{}");
    return { searchQuery: parsed.searchQuery || parts.join(" "), extractedLocation: parsed.location || location };
  } catch {
    return { searchQuery: parts.join(" "), extractedLocation: location };
  }
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
              phone: lead.phone || null, email: lead.email || null, website: lead.website || null,
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

    console.log(`\n=== SEARCH: "${searchQuery}" | excludeCount=${excludeSet.size} ===`);

    // ── Load pool from cache ──────────────────────────────────────────────────
    let pool = memRead(cacheKey);
    if (!pool) {
      pool = await dbRead(cacheKey);
      if (pool) memWrite(cacheKey, pool);
    }

    // ── Find unseen leads in current pool ─────────────────────────────────────
    const unseenInPool = pool ? pool.leads.filter(l => !excludeSet.has(l.placeId)) : [];

    console.log(`Pool size: ${pool?.leads.length ?? 0} | Unseen: ${unseenInPool.length} | HasToken: ${!!pool?.nextPageToken}`);

    // ── If enough unseen leads → return them directly ─────────────────────────
    if (unseenInPool.length >= BATCH_SIZE) {
      const toReturn = unseenInPool.slice(0, BATCH_SIZE);
      console.log(`Returning ${toReturn.length} cached unseen leads`);
      return NextResponse.json({ leads: toReturn, total: toReturn.length, totalInPool: pool!.leads.length });
    }

    // ── If some unseen but fewer than BATCH_SIZE → also try fetching next page ─
    // ── If zero unseen → definitely need next page ────────────────────────────
    if (pool?.nextPageToken) {
      console.log(`Fetching next Google page (token exists)...`);
      const { places: newPlaces, nextToken } = await fetchGooglePage(searchQuery, pool.nextPageToken);

      if (newPlaces.length > 0) {
        const newLeads    = await buildLeads(newPlaces, displayLoc);
        const existingIds = new Set(pool.leads.map(l => l.placeId));
        const fresh       = newLeads.filter(l => !existingIds.has(l.placeId));
        const updatedPool: PoolEntry = {
          leads:         [...pool.leads, ...fresh],
          nextPageToken: nextToken,
          location:      displayLoc,
        };

        memWrite(cacheKey, updatedPool);
        await dbWrite(cacheKey, updatedPool);
        if (userEmail) saveLeadsToDB(fresh, userEmail).catch(() => {});

        console.log(`Appended ${fresh.length} new leads. Total pool: ${updatedPool.leads.length}. NextToken: ${!!nextToken}`);

        // Now return unseen from the updated pool
        const allUnseen = updatedPool.leads.filter(l => !excludeSet.has(l.placeId));
        const toReturn  = allUnseen.slice(0, BATCH_SIZE);
        return NextResponse.json({ leads: toReturn, total: toReturn.length, totalInPool: updatedPool.leads.length });
      }
    }

    // ── No cache at all → first search ───────────────────────────────────────
    if (!pool) {
      console.log("No cache — fetching page 1 from Google...");
      const { places, nextToken } = await fetchGooglePage(searchQuery);

      if (!places.length) {
        return NextResponse.json({ leads: [], total: 0, message: "No results found for this search." });
      }

      const leads: LeadResult[] = await buildLeads(places, displayLoc);
      const newPool: PoolEntry  = { leads, nextPageToken: nextToken, location: displayLoc };

      memWrite(cacheKey, newPool);
      await dbWrite(cacheKey, newPool);
      if (userEmail) saveLeadsToDB(leads, userEmail).catch(() => {});

      console.log(`Page 1 done: ${leads.length} leads, nextToken=${!!nextToken}`);

      const unseen   = leads.filter(l => !excludeSet.has(l.placeId));
      const toReturn = unseen.slice(0, BATCH_SIZE);
      return NextResponse.json({ leads: toReturn, total: toReturn.length, totalInPool: leads.length });
    }

    // ── If we reach here: pool exists, no token, all leads seen ──────────────
    if (unseenInPool.length > 0) {
      const toReturn = unseenInPool.slice(0, BATCH_SIZE);
      return NextResponse.json({ leads: toReturn, total: toReturn.length, totalInPool: pool.leads.length });
    }

    console.log("Pool exhausted — no more pages available");
    return NextResponse.json({
      leads: [], total: 0, totalInPool: pool.leads.length, exhausted: true,
      message: "You've seen all available leads for this search. Try a different keyword or location.",
    });

  } catch (error: any) {
    console.error("Search error:", error);
    return NextResponse.json({ error: error.message, leads: [] }, { status: 500 });
  }
}