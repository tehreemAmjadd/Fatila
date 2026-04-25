// app/api/leads/search/route.ts
//
// HOW PAGINATION WORKS:
// ─────────────────────
// Google Places returns max 20 results + a next_page_token per request.
// The token only becomes valid ~2 seconds AFTER the first response —
// which means we CANNOT fetch all pages in one server call (sleep doesn't
// work reliably on serverless/Vercel).
//
// Solution: store the next_page_token in the DB cache alongside the leads.
// Each time the user searches the same keyword+location we:
//   1. Return the cached leads filtered by what they've already seen.
//   2. If a pagetoken exists, fire a background fetch for the NEXT page
//      and append those results to the cache for the next call.
//   3. If the current cached pool has no unseen leads left AND a token
//      exists, we fetch the next page synchronously so this request
//      itself returns new results.
//
// This way pagination is completely transparent to the user — they just
// click "Search Leads" again and get the next batch.
//
// Prisma model needed (run `npx prisma db push` after adding):
//
//  model SearchCache {
//    id            String   @id @default(cuid())
//    cacheKey      String   @unique
//    leadsJson     String   @db.Text
//    nextPageToken String?  @db.Text   // ← NEW FIELD
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

const MEMORY_CACHE_TTL_MS = 30 * 60 * 1000; // 30 min
const DB_CACHE_TTL_HOURS  = 24;

// ─────────────────────────────────────────────────────────────────────────────
// Types
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

interface CacheEntry {
  leads: LeadResult[];
  nextPageToken: string | null;
  location: string;
  expiresAt: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// In-memory cache (module-level, survives warm lambdas)
// ─────────────────────────────────────────────────────────────────────────────

const memoryCache = new Map<string, CacheEntry>();

function toCacheKey(q: string) {
  return q.toLowerCase().trim().replace(/\s+/g, " ");
}

function readMemoryCache(key: string): CacheEntry | null {
  const e = memoryCache.get(key);
  if (!e) return null;
  if (Date.now() > e.expiresAt) { memoryCache.delete(key); return null; }
  return e;
}

function writeMemoryCache(key: string, entry: Omit<CacheEntry, "expiresAt">) {
  memoryCache.set(key, { ...entry, expiresAt: Date.now() + MEMORY_CACHE_TTL_MS });
}

// ─────────────────────────────────────────────────────────────────────────────
// DB cache — stores leads + nextPageToken
// ─────────────────────────────────────────────────────────────────────────────

async function readDBCache(key: string): Promise<CacheEntry | null> {
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
      expiresAt: new Date(row.expiresAt).getTime(),
    };
  } catch {
    return null;
  }
}

async function writeDBCache(
  key: string,
  leads: LeadResult[],
  nextPageToken: string | null,
  location: string
) {
  try {
    const expiresAt = new Date(Date.now() + DB_CACHE_TTL_HOURS * 3600 * 1000);
    await (db as any).searchCache.upsert({
      where: { cacheKey: key },
      update: { leadsJson: JSON.stringify(leads), nextPageToken, location, expiresAt },
      create: { cacheKey: key, leadsJson: JSON.stringify(leads), nextPageToken, location, expiresAt },
    });
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// AI query parser
// ─────────────────────────────────────────────────────────────────────────────

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
        messages: [{ role: "user", content: `Convert this lead search into a short Google Places query (3-6 words).
Keyword: "${keyword}" | Industry: "${industry}" | Location: "${location}"
Reply ONLY as JSON: {"searchQuery":"...","location":"..."}` }],
      }),
    });
    const d = await res.json();
    const parsed = JSON.parse(d.choices?.[0]?.message?.content?.replace(/```json|```/g, "").trim() || "{}");
    return {
      searchQuery: parsed.searchQuery || parts.join(" "),
      extractedLocation: parsed.location || location,
    };
  } catch {
    return { searchQuery: parts.join(" "), extractedLocation: location };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Google Places helpers
// ─────────────────────────────────────────────────────────────────────────────

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
 * Fetch ONE page of Google Places results.
 * Pass `pagetoken` for page 2/3, omit for page 1 (uses `query`).
 * Returns { results, nextPageToken }.
 */
async function fetchOnePage(
  query: string,
  pagetoken?: string
): Promise<{ results: PlaceResult[]; nextPageToken: string | null }> {
  let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?key=${GOOGLE_API_KEY}`;

  if (pagetoken) {
    url += `&pagetoken=${encodeURIComponent(pagetoken)}`;
    console.log("Google Places: fetching page via pagetoken");
  } else {
    url += `&query=${encodeURIComponent(query)}`;
    console.log("Google Places: fetching page 1 for:", query);
  }

  const res  = await fetch(url, { cache: "no-store" });
  const data = await res.json();

  console.log(`Google status: ${data.status} | results: ${data.results?.length ?? 0} | hasNextToken: ${!!data.next_page_token}`);

  if (data.status !== "OK" || !data.results?.length) {
    return { results: [], nextPageToken: null };
  }

  // Fetch full details for this page's places
  const details = await Promise.all(
    data.results.map((r: any) => getPlaceDetails(r.place_id))
  );

  return {
    results: details.filter(Boolean) as PlaceResult[],
    nextPageToken: data.next_page_token ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────────────────────────────────────

function guessEmail(website: string): string | null {
  if (!website) return null;
  try {
    return "info@" + website.replace(/https?:\/\//, "").split("/")[0].replace(/^www\./, "");
  } catch { return null; }
}

function inferIndustry(types: string[]): string {
  const map: Record<string, string> = {
    restaurant:"Food & Beverage", food:"Food & Beverage", cafe:"Food & Beverage",
    hospital:"Healthcare", doctor:"Healthcare", pharmacy:"Healthcare", dentist:"Healthcare",
    school:"Education", university:"Education",
    gym:"Fitness", spa:"Wellness",
    store:"Retail", clothing_store:"Retail", shopping_mall:"Retail",
    bank:"Finance", finance:"Finance", accounting:"Finance",
    real_estate_agency:"Real Estate", car_dealer:"Automotive", car_repair:"Automotive",
    hotel:"Hospitality", lodging:"Hospitality", lawyer:"Legal", travel_agency:"Travel",
    beauty_salon:"Beauty", hair_care:"Beauty",
    electronics_store:"Technology", insurance_agency:"Finance",
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
  score: number, displayLocation: string, email: string | null
): Promise<string> {
  const phone = place.formatted_phone_number || place.international_phone_number || "";
  const base =
    `${place.name} is a ${priority.toLowerCase()}-priority ${industry} lead in ${displayLocation} (score: ${score}/100).` +
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
          `B2B sales analyst: write 2-3 sentences on why this is a good lead (no bullet points, no score mentions):
Business: ${place.name} | Industry: ${industry} | Location: ${place.formatted_address || displayLocation}
Types: ${(place.types||[]).join(", ")} | Rating: ${place.rating||"N/A"} (${place.user_ratings_total||0} reviews)
Has Website: ${place.website?"Yes":"No"} | Has Phone: ${phone?"Yes":"No"}`
        }],
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

async function buildLeadsFromPlaces(
  places: PlaceResult[], displayLocation: string
): Promise<LeadResult[]> {
  const BATCH = 10;
  const out: LeadResult[] = [];
  for (let i = 0; i < places.length; i += BATCH) {
    const batch = await Promise.all(
      places.slice(i, i + BATCH).map(async place => {
        const score    = scorePlace(place);
        const priority = score >= 70 ? "High" : score >= 45 ? "Medium" : "Low";
        const phone    = place.formatted_phone_number || place.international_phone_number || "";
        const ind      = inferIndustry(place.types || []);
        const email    = guessEmail(place.website || "");
        const insight  = await generateAIInsight(place, ind, priority, score, displayLocation, email);
        return {
          placeId: place.place_id, company: place.name,
          address: place.formatted_address || "", phone, email,
          website: place.website || "", industry: ind,
          rating: place.rating || null, reviewCount: place.user_ratings_total || 0,
          score, priority, aiInsight: insight,
          linkedinUrl: `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(place.name)}`,
          fromCache: false,
        };
      })
    );
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
              phone: lead.phone || null, email: lead.email || null,
              website: lead.website || null, industry: lead.industry,
              score: lead.score, priority: lead.priority, aiInsights: lead.aiInsight,
              source: "google_maps", placeId: lead.placeId,
              linkedinUrl: lead.linkedinUrl, saved: false, status: "new",
            },
          });
        }
      } catch {}
    }
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN POST HANDLER
// ─────────────────────────────────────────────────────────────────────────────

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
    const cacheKey       = toCacheKey(searchQuery);
    const displayLoc     = extractedLocation || location || "this area";
    const excludeSet     = new Set<string>(excludePlaceIds);

    // ── Load cache ────────────────────────────────────────────────────────────
    let cached = readMemoryCache(cacheKey);
    if (!cached) {
      const dbRow = await readDBCache(cacheKey);
      if (dbRow) {
        cached = dbRow;
        writeMemoryCache(cacheKey, dbRow);
      }
    }

    // ── Determine which leads are unseen from current pool ────────────────────
    const currentPool  = cached?.leads ?? [];
    const unseenLeads  = currentPool.filter(l => !excludeSet.has(l.placeId));
    const pendingToken = cached?.nextPageToken ?? null;

    console.log(`Pool: ${currentPool.length} | Unseen: ${unseenLeads.length} | HasNextToken: ${!!pendingToken}`);

    // ── Case 1: We have unseen leads to show — return them ────────────────────
    // But also kick off background fetch of next page if token exists
    if (unseenLeads.length > 0) {
      // Background: fetch next page and append to cache (non-blocking)
      // This pre-loads page 2 while the user is reviewing page 1 results
      if (pendingToken) {
        (async () => {
          try {
            console.log("Background: fetching next page...");
            const { results: nextPlaces, nextPageToken: newToken } = await fetchOnePage(searchQuery, pendingToken);
            if (nextPlaces.length > 0) {
              const nextLeads = await buildLeadsFromPlaces(nextPlaces, displayLoc);
              // Deduplicate before appending
              const existingIds = new Set(currentPool.map(l => l.placeId));
              const fresh = nextLeads.filter(l => !existingIds.has(l.placeId));
              const updatedPool = [...currentPool, ...fresh];
              writeMemoryCache(cacheKey, { leads: updatedPool, nextPageToken: newToken, location: displayLoc });
              await writeDBCache(cacheKey, updatedPool, newToken, displayLoc);
              if (userEmail) await saveLeadsToDB(fresh, userEmail);
              console.log(`Background: appended ${fresh.length} new leads. Token now: ${!!newToken}`);
            }
          } catch (e) { console.error("Background fetch error:", e); }
        })();
      }

      return NextResponse.json({
        leads: unseenLeads,
        total: unseenLeads.length,
        totalInPool: currentPool.length,
        hasMore: !!pendingToken,
        fromCache: true,
      });
    }

    // ── Case 2: All cached leads already seen, but next page token exists ─────
    // Fetch next page synchronously so user gets new results NOW
    if (pendingToken) {
      console.log("All cached leads seen — fetching next page synchronously...");
      const { results: nextPlaces, nextPageToken: newToken } = await fetchOnePage(searchQuery, pendingToken);

      if (nextPlaces.length > 0) {
        const nextLeads = await buildLeadsFromPlaces(nextPlaces, displayLoc);
        const existingIds = new Set(currentPool.map(l => l.placeId));
        const fresh = nextLeads.filter(l => !existingIds.has(l.placeId));
        const updatedPool = [...currentPool, ...fresh];

        writeMemoryCache(cacheKey, { leads: updatedPool, nextPageToken: newToken, location: displayLoc });
        await writeDBCache(cacheKey, updatedPool, newToken, displayLoc);
        if (userEmail) await saveLeadsToDB(fresh, userEmail);

        // Return only the fresh (unseen) ones
        const freshUnseen = fresh.filter(l => !excludeSet.has(l.placeId));
        console.log(`Next page fetched: ${fresh.length} new leads, ${freshUnseen.length} unseen`);

        return NextResponse.json({
          leads: freshUnseen,
          total: freshUnseen.length,
          totalInPool: updatedPool.length,
          hasMore: !!newToken,
          fromCache: false,
        });
      }
    }

    // ── Case 3: No cache at all — first ever search ───────────────────────────
    if (currentPool.length === 0) {
      console.log("No cache — fetching page 1 from Google...");
      const { results: places, nextPageToken: token } = await fetchOnePage(searchQuery);

      if (!places.length) {
        return NextResponse.json({ leads: [], total: 0, hasMore: false, message: "No results found" });
      }

      const leads = await buildLeadsFromPlaces(places, displayLoc);
      writeMemoryCache(cacheKey, { leads, nextPageToken: token, location: displayLoc });
      await writeDBCache(cacheKey, leads, token, displayLoc);
      if (userEmail) await saveLeadsToDB(leads, userEmail);

      const unseen = leads.filter(l => !excludeSet.has(l.placeId));
      console.log(`Page 1 done: ${leads.length} leads, token: ${!!token}`);

      return NextResponse.json({
        leads: unseen,
        total: unseen.length,
        totalInPool: leads.length,
        hasMore: !!token,
        fromCache: false,
      });
    }

    // ── Case 4: Pool exhausted, no more pages ─────────────────────────────────
    console.log("All leads exhausted — no more pages available");
    return NextResponse.json({
      leads: [],
      total: 0,
      totalInPool: currentPool.length,
      hasMore: false,
      exhausted: true,
      message: "No more results available for this search. Try a different keyword or location.",
    });

  } catch (error: any) {
    console.error("Search error:", error);
    return NextResponse.json({ error: error.message, leads: [] }, { status: 500 });
  }
}