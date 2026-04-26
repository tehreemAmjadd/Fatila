// app/api/leads/search/route.ts
//
// STRATEGY:
// - Google Places se data fetch karo
// - Har website ko SYNCHRONOUSLY scrape karo (2s timeout, homepage only)
// - Regex se real emails/phones nikalo — no OpenAI for scraping
// - Sab kuch parallel chalao taake fast rahe
// - Total expected time: 8-15 seconds for 20 leads

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const GOOGLE_API_KEY =
  process.env.GOOGLE_PLACES_API_KEY ||
  process.env.GOOGLE_MAPS ||
  process.env.NEXT_PUBLIC_GOOGLE_MAPS ||
  "";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

const MEMORY_CACHE_TTL_MS = 2 * 60 * 60 * 1000;
const DB_CACHE_TTL_HOURS  = 48;
const RESULTS_PER_PAGE    = 20;
const SCRAPE_TIMEOUT_MS   = 2000; // 2 seconds max per website

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
  phones: string[];
  email: string | null;
  emails: string[];
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

function toCacheKey(q: string) { return q.toLowerCase().trim().replace(/\s+/g, " "); }

function memRead(key: string): LeadResult[] | null {
  const e = mem.get(key);
  if (!e) return null;
  if (Date.now() > e.expiresAt) { mem.delete(key); return null; }
  return e.leads;
}

function memWrite(key: string, leads: LeadResult[]) {
  mem.set(key, { leads, expiresAt: Date.now() + MEMORY_CACHE_TTL_MS });
}

// ─── DB cache ────────────────────────────────────────────────────────────────

async function dbRead(key: string): Promise<LeadResult[] | null> {
  try {
    const row = await (db as any).searchCache.findUnique({ where: { cacheKey: key } });
    if (!row) return null;
    if (new Date() > new Date(row.expiresAt)) {
      (db as any).searchCache.delete({ where: { cacheKey: key } }).catch(() => {});
      return null;
    }
    return JSON.parse(row.leadsJson) as LeadResult[];
  } catch { return null; }
}

async function dbWrite(key: string, leads: LeadResult[], location: string) {
  try {
    const expiresAt = new Date(Date.now() + DB_CACHE_TTL_HOURS * 3600 * 1000);
    await (db as any).searchCache.upsert({
      where:  { cacheKey: key },
      update: { leadsJson: JSON.stringify(leads), location, expiresAt },
      create: { cacheKey: key, leadsJson: JSON.stringify(leads), location, expiresAt },
    });
  } catch (e) { console.error("DB write:", e); }
}

// ─── Google Places ────────────────────────────────────────────────────────────

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

async function fetchOnePage(query: string): Promise<string[]> {
  try {
    const url  = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}`;
    const res  = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    console.log(`"${query}": ${data.status} - ${data.results?.length ?? 0}`);
    if (data.status !== "OK" || !data.results?.length) return [];
    return data.results.map((r: any) => r.place_id).filter(Boolean);
  } catch { return []; }
}

function generateQueryVariations(keyword: string, location: string): string[] {
  const kw  = keyword.toLowerCase().trim();
  const loc = location.trim();
  const synonyms: Record<string, string[]> = {
    "software companies":  ["software houses", "software firms", "IT companies"],
    "software company":    ["software house", "software firm", "IT company"],
    "software house":      ["software company", "software firm", "IT firm"],
    "software houses":     ["software companies", "IT companies", "tech companies"],
    "it companies":        ["software companies", "tech companies", "IT firms"],
    "it company":          ["software company", "tech company", "IT firm"],
    "dental clinic":       ["dentist", "dental center", "dental office"],
    "dental clinics":      ["dentists", "dental centers", "dental offices"],
    "restaurant":          ["cafe", "eatery", "food place"],
    "restaurants":         ["cafes", "eateries", "food places"],
    "law firm":            ["lawyer", "legal firm", "attorney"],
    "law firms":           ["lawyers", "legal firms", "attorneys"],
    "real estate":         ["property dealer", "real estate agency", "property agent"],
    "hospital":            ["clinic", "medical center", "healthcare center"],
    "hospitals":           ["clinics", "medical centers", "healthcare centers"],
    "gym":                 ["fitness center", "health club", "workout center"],
    "gyms":                ["fitness centers", "health clubs", "workout centers"],
    "school":              ["academy", "institute", "educational center"],
    "schools":             ["academies", "institutes", "educational centers"],
    "hotel":               ["guest house", "inn", "lodging"],
    "hotels":              ["guest houses", "inns", "lodgings"],
    "marketing agency":    ["digital agency", "advertising agency", "marketing firm"],
    "marketing agencies":  ["digital agencies", "advertising agencies", "marketing firms"],
    "construction":        ["builder", "contractor", "construction company"],
    "pharmacy":            ["chemist", "drugstore", "medical store"],
    "pharmacies":          ["chemists", "drugstores", "medical stores"],
  };
  let variations: string[] = [];
  for (const [key, syns] of Object.entries(synonyms)) {
    if (kw.includes(key)) { variations = syns.map(s => kw.replace(key, s)); break; }
  }
  if (!variations.length) variations = [`${kw} company`, `best ${kw}`];
  return [...new Set([`${kw} ${loc}`, `${variations[0]} ${loc}`, `${variations[1] || variations[0]} ${loc}`])];
}

async function fetchAllPlaceIds(keyword: string, location: string): Promise<string[]> {
  const queries = generateQueryVariations(keyword, location);
  const results = await Promise.all(queries.map(q => fetchOnePage(q)));
  const seen = new Set<string>();
  const allIds: string[] = [];
  for (const ids of results) {
    for (const id of ids) {
      if (!seen.has(id)) { seen.add(id); allIds.push(id); }
    }
  }
  console.log(`Total unique IDs: ${allIds.length}`);
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

// ─── FAST website scraper: 2s timeout, regex only, no OpenAI ─────────────────
// Fetches homepage + /contact page in parallel

async function scrapeContactInfo(websiteUrl: string): Promise<{ emails: string[]; phones: string[] }> {
  if (!websiteUrl) return { emails: [], phones: [] };

  const base = websiteUrl.replace(/\/$/, "");

  // Fetch homepage and /contact in parallel with 2s timeout each
  async function fetchWithTimeout(url: string): Promise<string> {
    try {
      const ctrl = new AbortController();
      const t    = setTimeout(() => ctrl.abort(), SCRAPE_TIMEOUT_MS);
      const res  = await fetch(url, {
        signal:  ctrl.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; LeadBot/1.0)", "Accept": "text/html" },
        cache:   "no-store",
      });
      clearTimeout(t);
      if (!res.ok) return "";
      const html = await res.text();
      // Strip tags, collapse whitespace, limit size
      return html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .slice(0, 6000);
    } catch { return ""; }
  }

  // Both pages in parallel — total wait = max(homepage, contact) not sum
  const [homeText, contactText] = await Promise.all([
    fetchWithTimeout(base),
    fetchWithTimeout(`${base}/contact`),
  ]);

  const text = (homeText + " " + contactText).trim();
  if (!text) return { emails: [], phones: [] };

  // ── Regex extraction ─────────────────────────────────────────────────────
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const phoneRegex = /(?:\+?\d[\d\s\-(). ]{5,}\d)/g;

  const emails = [...new Set((text.match(emailRegex) || []).filter(e =>
    !e.match(/\.(png|jpg|jpeg|gif|svg|webp|css|js|woff|ttf|eot)$/i) &&
    !e.startsWith("//") &&
    e.length < 80 &&
    e.includes(".") &&
    !e.includes("example.com") &&
    !e.includes("youremail") &&
    !e.includes("email@")
  ))].slice(0, 8);

  const phones = [...new Set(
    (text.match(phoneRegex) || [])
      .map(p => p.trim().replace(/^[^\d+]+/, "")) // strip leading non-digits
      .filter(p => {
        const digits = p.replace(/\D/g, "");
        return digits.length >= 7 && digits.length <= 15;
      })
  )].slice(0, 6);

  console.log(`  Scraped ${base}: ${emails.length} emails, ${phones.length} phones`);
  return { emails, phones };
}

// ─── AI Insight ───────────────────────────────────────────────────────────────

async function generateAIInsight(
  place: PlaceResult, industry: string, priority: string,
  score: number, loc: string, primaryEmail: string | null
): Promise<string> {
  const phone = place.formatted_phone_number || place.international_phone_number || "";
  const base  =
    `${place.name} is a ${priority.toLowerCase()}-priority ${industry} lead in ${loc} (score: ${score}/100).` +
    (place.rating ? ` Rated ${place.rating}⭐ by ${(place.user_ratings_total||0).toLocaleString()} customers.` : "") +
    (place.website ? ` Website: ${place.website.replace(/https?:\/\//, "").split("/")[0]}.` : " No website.") +
    (phone ? " Phone available." : " No phone.") +
    (primaryEmail ? ` Email: ${primaryEmail}.` : "");
  if (!OPENAI_API_KEY) return base;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o-mini", max_tokens: 100, temperature: 0.7,
        messages: [{ role: "user", content:
          `B2B analyst: 2 sentences why this is a good lead (no bullets, no score mention):
${place.name} | ${industry} | ${place.formatted_address||loc} | Rating: ${place.rating||"N/A"} (${place.user_ratings_total||0} reviews) | Website: ${place.website?"Yes":"No"} | Phone: ${phone?"Yes":"No"}` }],
      }),
    });
    const d    = await res.json();
    const text = d.choices?.[0]?.message?.content?.trim() || "";
    if (!text) return base;
    return `${text}\n\n📊 ${score}/100 · ${priority}` +
      (place.rating ? ` · ⭐ ${place.rating} (${(place.user_ratings_total||0).toLocaleString()})` : "") +
      (phone ? ` · 📞 ${phone}` : "") +
      (primaryEmail ? ` · 📧 ${primaryEmail}` : "");
  } catch { return base; }
}

// ─── Build leads: scraping + AI insight all in parallel per lead ──────────────

async function buildLeads(places: PlaceResult[], loc: string): Promise<LeadResult[]> {
  const out: LeadResult[] = [];

  // Process in batches of 8 to avoid overwhelming servers
  const BATCH = 8;
  for (let i = 0; i < places.length; i += BATCH) {
    const batch = await Promise.all(places.slice(i, i + BATCH).map(async p => {
      const score    = scorePlace(p);
      const priority = score >= 70 ? "High" : score >= 45 ? "Medium" : "Low";
      const ind      = inferIndustry(p.types || []);
      const googlePhone = p.formatted_phone_number || p.international_phone_number || "";

      // Scraping + AI insight in parallel for each lead
      const [scraped, _] = await Promise.all([
        p.website ? scrapeContactInfo(p.website) : Promise.resolve({ emails: [], phones: [] }),
        Promise.resolve(null), // placeholder
      ]);

      // Phones: google first, then scraped
      const allPhones = [...new Set([
        ...(googlePhone ? [googlePhone] : []),
        ...(scraped.phones || []),
      ])];

      // Emails: real scraped ones, fallback to guessed
      const allEmails = scraped.emails.length > 0
        ? scraped.emails
        : (guessEmail(p.website || "") ? [guessEmail(p.website || "")!] : []);

      const primaryEmail = allEmails[0] || null;
      const insight = await generateAIInsight(p, ind, priority, score, loc, primaryEmail);

      return {
        placeId:     p.place_id,
        company:     p.name,
        address:     p.formatted_address || "",
        phone:       allPhones[0] || "",
        phones:      allPhones,
        email:       primaryEmail,
        emails:      allEmails,
        website:     p.website || "",
        industry:    ind,
        rating:      p.rating || null,
        reviewCount: p.user_ratings_total || 0,
        score, priority, aiInsight: insight,
        linkedinUrl: `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(p.name)}`,
        fromCache:   false,
      } as LeadResult;
    }));
    out.push(...batch);
  }
  return out;
}

// ─── Save to DB ───────────────────────────────────────────────────────────────

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
      return NextResponse.json({ error: "Provide keyword or location", leads: [] }, { status: 400 });
    }

    const rawKeyword  = (keyword || industry).toLowerCase().trim();
    const rawLocation = location.toLowerCase().trim();
    const cacheKey    = toCacheKey(`${rawKeyword} ${rawLocation}`);
    const displayLoc  = location || "this area";
    const excludeSet  = new Set<string>(excludePlaceIds);

    console.log(`\n=== SEARCH: "${cacheKey}" | excluded=${excludeSet.size} ===`);

    // ── Check cache ───────────────────────────────────────────────────────────
    let pool = memRead(cacheKey);
    if (!pool) {
      pool = await dbRead(cacheKey);
      if (pool) memWrite(cacheKey, pool);
    }

    if (pool && pool.length > 0) {
      const unseen = pool.filter(l => !excludeSet.has(l.placeId));
      if (unseen.length > 0) {
        const toReturn = unseen.slice(0, RESULTS_PER_PAGE);
        console.log(`Cache hit: returning ${toReturn.length}`);
        return NextResponse.json({ leads: toReturn, total: toReturn.length, totalInPool: pool.length, remainingUnseen: unseen.length - toReturn.length });
      }
      return NextResponse.json({ leads: [], total: 0, totalInPool: pool.length, exhausted: true, message: "All leads seen. Try a different keyword or location." });
    }

    // ── Fetch fresh from Google ───────────────────────────────────────────────
    console.log("Fresh fetch from Google...");
    const allPlaceIds = await fetchAllPlaceIds(rawKeyword, rawLocation);
    if (!allPlaceIds.length) {
      return NextResponse.json({ leads: [], total: 0, message: "No results found." });
    }

    console.log(`Fetching details for ${allPlaceIds.length} places...`);
    const details  = await Promise.all(allPlaceIds.map(id => getDetails(id)));
    const places   = details.filter(Boolean) as PlaceResult[];

    // Build leads WITH scraping (all parallel, 2s timeout per site)
    console.log(`Building ${places.length} leads with scraping...`);
    const allLeads = await buildLeads(places, displayLoc);
    console.log(`Done: ${allLeads.length} leads built`);

    // Cache and save
    memWrite(cacheKey, allLeads);
    dbWrite(cacheKey, allLeads, displayLoc).catch(() => {});
    if (userEmail) saveLeadsToDB(allLeads, userEmail).catch(() => {});

    const unseen   = allLeads.filter(l => !excludeSet.has(l.placeId));
    const toReturn = unseen.slice(0, RESULTS_PER_PAGE);

    return NextResponse.json({
      leads: toReturn, total: toReturn.length,
      totalInPool: allLeads.length, remainingUnseen: unseen.length - toReturn.length,
    });

  } catch (error: any) {
    console.error("Search error:", error);
    return NextResponse.json({ error: error.message, leads: [] }, { status: 500 });
  }
}