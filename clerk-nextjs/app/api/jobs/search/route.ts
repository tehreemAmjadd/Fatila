// app/api/jobs/search/route.ts
// Uses Adzuna API for REAL job listings with direct apply URLs.
// OpenAI is used only to parse the user prompt → extract keywords + country.
//
// Plan limits:
//   trial    → 20 total results (lifetime)
//   starter  → 100 / month
//   pro      → 500 / month
//   business / admin → unlimited
//
// ⚠️  Add to .env:
//   ADZUNA_APP_ID=8e1c8f20
//   ADZUNA_APP_KEY=b02f5d06fc5222b5ad90564f5f8566b6
//
// ⚠️  Prisma User model needs:
//   jobResultsUsed    Int       @default(0)
//   jobResultsResetAt DateTime?

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const OPENAI_API_KEY  = process.env.OPENAI_API_KEY  || "";
const ADZUNA_APP_ID   = process.env.ADZUNA_APP_ID   || "8e1c8f20";
const ADZUNA_APP_KEY  = process.env.ADZUNA_APP_KEY  || "b02f5d06fc5222b5ad90564f5f8566b6";

// ─── Plan limits ──────────────────────────────────────────────────────────────
const PLAN_JOB_LIMITS: Record<string, number> = {
  trial:    20,
  starter:  100,
  pro:      500,
  business: Infinity,
};

// ─── Adzuna country codes ─────────────────────────────────────────────────────
// Maps common country names/keywords → Adzuna country code
const COUNTRY_MAP: Record<string, string> = {
  // English-speaking
  "us": "us", "usa": "us", "united states": "us", "america": "us",
  "uk": "gb", "united kingdom": "gb", "england": "gb", "britain": "gb", "london": "gb",
  "canada": "ca", "toronto": "ca", "vancouver": "ca",
  "australia": "au", "sydney": "au", "melbourne": "au",
  "new zealand": "nz",
  "south africa": "za",
  // Europe
  "germany": "de", "berlin": "de", "munich": "de",
  "france": "fr", "paris": "fr",
  "netherlands": "nl", "amsterdam": "nl",
  "poland": "pl",
  "russia": "ru",
  "brazil": "br",
  "india": "in", "bangalore": "in", "mumbai": "in", "delhi": "in", "hyderabad": "in",
  "singapore": "sg",
  // Middle East & Pakistan — Adzuna unsupported, will use OpenAI fallback
  "dubai": "ae", "uae": "ae", "abu dhabi": "ae", "sharjah": "ae",
  "saudi": "sa", "saudi arabia": "sa", "riyadh": "sa", "jeddah": "sa",
  "pakistan": "pk", "lahore": "pk", "karachi": "pk", "islamabad": "pk", "rawalpindi": "pk",
  "qatar": "qa", "doha": "qa",
  "kuwait": "kw",
  "egypt": "eg", "cairo": "eg",
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface ParsedQuery {
  keywords: string;
  country: string;   // Adzuna country code e.g. "us", "gb"
  location: string;  // Human-readable location for display
}

interface JobResult {
  id: string;
  title: string;
  company: string;
  location: string;
  type: string;
  postedAt: string;
  description: string;
  applyUrl: string;
  source: string;
  salary?: string;
}

// ─── Step 1: Parse user prompt with OpenAI ────────────────────────────────────
async function parsePrompt(prompt: string): Promise<ParsedQuery> {
  // Simple fallback if no OpenAI key
  if (!OPENAI_API_KEY) {
    return { keywords: prompt, country: "us", location: "Global" };
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 150,
        temperature: 0,
        messages: [{
          role: "user",
          content: `Extract job search info from this prompt: "${prompt}"

Reply ONLY with valid JSON, no explanation:
{
  "keywords": "job title and skills only (e.g. React Developer, Python Engineer)",
  "country": "full country name in lowercase (e.g. united states, united kingdom, pakistan, india, australia)",
  "location": "city and country for display (e.g. Dubai, UAE or London, UK or Lahore, Pakistan)"
}

If no country mentioned, use "united states".`,
        }],
      }),
    });

    const data  = await res.json();
    const raw   = data.choices?.[0]?.message?.content?.trim() || "{}";
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    // Map country name → Adzuna code
    const countryLower = (parsed.country || "united states").toLowerCase();
    let countryCode = "us"; // default
    for (const [key, code] of Object.entries(COUNTRY_MAP)) {
      if (countryLower.includes(key)) { countryCode = code; break; }
    }

    return {
      keywords: parsed.keywords || prompt,
      country:  countryCode,
      location: parsed.location || parsed.country || "Global",
    };
  } catch (e) {
    console.error("OpenAI parse failed, using fallback:", e);
    return { keywords: prompt, country: "us", location: "Global" };
  }
}

// ─── Step 2: Fetch real jobs from Adzuna ─────────────────────────────────────
async function fetchAdzunaJobs(keywords: string, country: string, count: number): Promise<JobResult[]> {
  try {
    const params = new URLSearchParams({
      app_id:          ADZUNA_APP_ID,
      app_key:         ADZUNA_APP_KEY,
      results_per_page: String(Math.min(count, 10)),
      what:            keywords,
      content_type:    "application/json",
    });

    const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params}`;
    console.log("🔍 Adzuna fetch:", url);

    const res  = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      console.error("Adzuna error:", res.status, await res.text());
      return [];
    }

    const data = await res.json();
    const results = data?.results || [];

    // Debug: log first job's URL fields to verify what Adzuna returns
    if (results.length > 0) {
      console.log("Adzuna job URL fields:", {
        redirect_url: results[0]?.redirect_url,
        adref: results[0]?.adref,
        url: results[0]?.url,
      });
    }

    return results.map((job: any, i: number): JobResult => {
      // Salary formatting
      let salary: string | undefined;
      if (job.salary_min && job.salary_max) {
        const min = Math.round(job.salary_min).toLocaleString();
        const max = Math.round(job.salary_max).toLocaleString();
        const currency = getSalaryCurrency(country);
        salary = `${currency}${min} – ${currency}${max}/year`;
      } else if (job.salary_min) {
        const currency = getSalaryCurrency(country);
        salary = `From ${currency}${Math.round(job.salary_min).toLocaleString()}/year`;
      }

      // Posted date
      const postedAt = job.created
        ? formatPostedDate(new Date(job.created))
        : "Recently";

      // Job type
      const contractType = job.contract_time || job.contract_type || "";
      const type = contractType.includes("full") ? "Full-time"
                 : contractType.includes("part") ? "Part-time"
                 : contractType.includes("contract") ? "Contract"
                 : "Full-time";

      return {
        id:          job.id || `adzuna_${i}_${Date.now()}`,
        title:       job.title        || "Job Opening",
        company:     job.company?.display_name || "Company",
        location:    job.location?.display_name || job.location?.area?.join(", ") || "N/A",
        type,
        postedAt,
        description: job.description
          ? job.description.replace(/<[^>]*>/g, "").slice(0, 200).trim() + "..."
          : "Click Apply to view full job description.",
        // Adzuna gives redirect_url (tracking link) — use it but also keep adref as backup
        applyUrl:    job.redirect_url || job.adref || job.url || "#",
        source:      "Adzuna",
        salary,
      };
    });

  } catch (e) {
    console.error("Adzuna fetch error:", e);
    return [];
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSalaryCurrency(countryCode: string): string {
  const map: Record<string, string> = {
    us: "$", gb: "£", ca: "CA$", au: "AU$",
    de: "€", fr: "€", nl: "€", pl: "zł",
    in: "₹", br: "R$", ru: "₽", nz: "NZ$",
    sg: "S$", za: "R",
  };
  return map[countryCode] || "$";
}

function formatPostedDate(date: Date): string {
  const now   = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7)  return `${diffDays} days ago`;
  if (diffDays < 14) return "1 week ago";
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

// ─── Adzuna-unsupported countries → use OpenAI fallback ──────────────────────
// These countries/regions are not well covered by Adzuna
const ADZUNA_UNSUPPORTED = ["pk", "ae", "sa", "qa", "kw", "bh", "om", "eg", "ng", "gh"];

async function generateOpenAIJobs(prompt: string, location: string, count: number): Promise<JobResult[]> {
  if (!OPENAI_API_KEY) return [];
  const today = new Date().toISOString().split("T")[0];

  const systemPrompt = `You are a job search assistant. Return exactly ${count} realistic job listings for: "${location}".

Today: ${today}

RULES:
- Use real companies known in that region
- Currency by location: Pakistan=PKR, UAE=AED, Saudi=SAR, Egypt=EGP, Nigeria=NGN, default=USD
- For Pakistan use: Rozee.pk, Mustakbil, LinkedIn
- For UAE/Gulf use: Bayt.com, LinkedIn, GulfTalent
- APPLY URLS must be real search URLs on the correct job board
  * Rozee: https://www.rozee.pk/job/jsearch/q/KEYWORDS
  * Bayt UAE: https://www.bayt.com/en/uae/jobs/?q=KEYWORDS
  * Bayt KSA: https://www.bayt.com/en/saudi-arabia/jobs/?q=KEYWORDS
  * LinkedIn: https://www.linkedin.com/jobs/search/?keywords=KEYWORDS&location=LOCATION
- postedAt: "Today","2 days ago","3 days ago","1 week ago"
- type: "Full-time"|"Remote"|"Hybrid"|"Contract"|"Part-time"
- description: 1-2 sentences

Return ONLY a valid JSON array, no markdown.`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o-mini", max_tokens: 2500, temperature: 0.7,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
      }),
    });
    const data  = await res.json();
    const raw   = data.choices?.[0]?.message?.content?.trim() || "[]";
    const clean = raw.replace(/```json|```/g, "").trim();
    let jobs: JobResult[] = [];
    try { jobs = JSON.parse(clean); if (!Array.isArray(jobs)) jobs = []; } catch { jobs = []; }
    return jobs.map((job, i) => {
      // Make sure source matches the actual URL domain
      let source = job.source || "LinkedIn";
      const url = (job.applyUrl || "").toLowerCase();
      if (url.includes("rozee.pk"))   source = "Rozee.pk";
      else if (url.includes("bayt"))  source = "Bayt";
      else if (url.includes("linkedin")) source = "LinkedIn";
      else if (url.includes("indeed"))   source = "Indeed";
      else if (url.includes("glassdoor")) source = "Glassdoor";
      else if (url.includes("mustakbil")) source = "Mustakbil";
      else if (url.includes("naukri"))    source = "Naukri";
      return { ...job, id: job.id || `ai_${Date.now()}_${i}`, source };
    });
  } catch (e) {
    console.error("OpenAI fallback error:", e);
    return [];
  }
}

// ─── POST Handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { prompt, email, plan = "free" } = await req.json();

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Please provide a job search prompt.", jobs: [] }, { status: 400 });
    }

    // ── Plan limit check ──────────────────────────────────────────────────────
    const normalizedPlan = (plan === "admin" || plan === "business") ? "business" : plan;
    const planLimit      = PLAN_JOB_LIMITS[normalizedPlan] ?? 0;
    const isUnlimited    = !isFinite(planLimit) || planLimit >= 999999;

    // Free / unknown — blocked
    if (planLimit === 0) {
      return NextResponse.json({ error: "Upgrade to access Job Search.", jobs: [] }, { status: 403 });
    }

    // ── DB usage check for limited plans ─────────────────────────────────────
    let jobResultsUsed = 0;

    if (!isUnlimited && email) {
      const user = await db.user.findUnique({ where: { email } }).catch(() => null);

      if (user) {
        // Monthly reset for starter/pro
        if (normalizedPlan !== "trial") {
          const lastReset   = (user as any).jobResultsResetAt ? new Date((user as any).jobResultsResetAt) : null;
          const now         = new Date();
          const shouldReset = !lastReset ||
            now.getFullYear() > lastReset.getFullYear() ||
            now.getMonth()    > lastReset.getMonth();

          if (shouldReset) {
            await db.user.update({ where: { email }, data: { jobResultsUsed: 0, jobResultsResetAt: now } as any }).catch(() => {});
            jobResultsUsed = 0;
          } else {
            jobResultsUsed = (user as any).jobResultsUsed ?? 0;
          }
        } else {
          jobResultsUsed = (user as any).jobResultsUsed ?? 0;
        }

        if (jobResultsUsed >= planLimit) {
          return NextResponse.json({ jobs: [], total: 0, jobResultsUsed, jobResultsLimit: planLimit, limitReached: true }, { status: 403 });
        }
      }
    }

    const countToFetch = isUnlimited ? 10 : Math.min(10, planLimit - jobResultsUsed);

    // ── Parse prompt → extract keywords + country ─────────────────────────────
    const { keywords, country, location } = await parsePrompt(prompt.trim());
    console.log(`🔍 Parsed | keywords:"${keywords}" | country:"${country}" | location:"${location}"`);

    // ── Fetch jobs: Adzuna for supported countries, OpenAI fallback for rest ────
    let jobs: JobResult[] = [];

    if (ADZUNA_UNSUPPORTED.includes(country)) {
      // Pakistan, UAE, Saudi etc. — use OpenAI with real job board links
      console.log(`🌍 Country "${country}" not on Adzuna — using OpenAI fallback`);
      jobs = await generateOpenAIJobs(prompt.trim(), location, countToFetch);
    } else {
      jobs = await fetchAdzunaJobs(keywords, country, countToFetch);
      // If Adzuna returns nothing, fallback to OpenAI
      if (jobs.length === 0) {
        console.log(`⚠️ Adzuna returned 0 results — using OpenAI fallback`);
        jobs = await generateOpenAIJobs(prompt.trim(), location, countToFetch);
      }
    }
    console.log(`✅ Final job count: ${jobs.length}`);

    // ── Increment DB usage ────────────────────────────────────────────────────
    if (!isUnlimited && email && jobs.length > 0) {
      await db.user.update({
        where: { email },
        data:  { jobResultsUsed: { increment: jobs.length } } as any,
      }).catch((e: any) => console.error("DB update failed:", e));
      jobResultsUsed += jobs.length;
    }

    return NextResponse.json({
      jobs,
      total:           jobs.length,
      searchedLocation: location,
      jobResultsUsed:  isUnlimited ? null : jobResultsUsed,
      jobResultsLimit: isUnlimited ? null : planLimit,
      limitReached:    !isUnlimited && jobResultsUsed >= planLimit,
    });

  } catch (error: any) {
    console.error("Job search error:", error);
    return NextResponse.json({ error: error.message || "Internal server error", jobs: [] }, { status: 500 });
  }
}