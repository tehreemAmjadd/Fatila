// app/api/jobs/search/route.ts
// Uses JSearch API (RapidAPI) for REAL job listings worldwide including Pakistan.
// OpenAI is used only to parse the user prompt → extract keywords + location.
//
// Plan limits:
//   trial    → 20 total results (lifetime)
//   starter  → 100 / month
//   pro      → 500 / month
//   business / admin → unlimited
//
// ⚠️  Add to .env:
//   JSEARCH_API_KEY=your_rapidapi_key_here
//   OPENAI_API_KEY=your_openai_key (optional, for better prompt parsing)

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const OPENAI_API_KEY  = process.env.OPENAI_API_KEY  || "";
const JSEARCH_API_KEY = process.env.JSEARCH_API_KEY || "";
const ADZUNA_APP_ID   = process.env.ADZUNA_APP_ID   || "8e1c8f20";
const ADZUNA_APP_KEY  = process.env.ADZUNA_APP_KEY  || "b02f5d06fc5222b5ad90564f5f8566b6";

// ─── Plan limits ──────────────────────────────────────────────────────────────
const PLAN_JOB_LIMITS: Record<string, number> = {
  trial:    20,
  starter:  100,
  pro:      500,
  business: Infinity,
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface ParsedQuery {
  keywords: string;
  location: string;    // city + country for display and search
  country:  string;    // adzuna country code (fallback)
  countryName: string; // full country name
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
  if (!OPENAI_API_KEY) {
    return { keywords: prompt, location: prompt, country: "us", countryName: "united states" };
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
          content: `Extract job search info from: "${prompt}"

Reply ONLY valid JSON:
{
  "keywords": "job title only (e.g. Software Developer, React Developer)",
  "location": "city and country (e.g. Lahore, Pakistan or New York, United States)",
  "countryName": "country name lowercase (e.g. pakistan, united states, india)"
}

If no country, default to "united states".`,
        }],
      }),
    });
    const data   = await res.json();
    const raw    = data.choices?.[0]?.message?.content?.trim() || "{}";
    const clean  = raw.replace(/\`\`\`json|\`\`\`/g, "").trim();
    const parsed = JSON.parse(clean);

    // Map to adzuna country code (for fallback)
    const COUNTRY_MAP: Record<string, string> = {
      "us": "us", "usa": "us", "united states": "us", "america": "us",
      "uk": "gb", "united kingdom": "gb", "england": "gb", "britain": "gb",
      "canada": "ca", "australia": "au", "new zealand": "nz", "south africa": "za",
      "germany": "de", "france": "fr", "netherlands": "nl", "india": "in",
      "singapore": "sg", "brazil": "br", "pakistan": "pk",
      "uae": "ae", "united arab emirates": "ae", "saudi arabia": "sa",
    };
    const cn = (parsed.countryName || "united states").toLowerCase();
    let countryCode = "us";
    for (const [key, code] of Object.entries(COUNTRY_MAP)) {
      if (cn.includes(key)) { countryCode = code; break; }
    }

    return {
      keywords:    parsed.keywords    || prompt,
      location:    parsed.location    || prompt,
      country:     countryCode,
      countryName: parsed.countryName || "united states",
    };
  } catch (e) {
    console.error("OpenAI parse failed:", e);
    return { keywords: prompt, location: prompt, country: "us", countryName: "united states" };
  }
}

// ─── Step 2a: JSearch API (RapidAPI) — works worldwide including Pakistan ─────
async function fetchJSearchJobs(keywords: string, location: string, count: number): Promise<JobResult[]> {
  if (!JSEARCH_API_KEY) return [];
  try {
    const query = `${keywords} in ${location}`;
    const url   = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(query)}&page=1&num_pages=1&date_posted=all`;

    console.log("JSearch fetch:", query);
    const res = await fetch(url, {
      headers: {
        "X-RapidAPI-Key":  JSEARCH_API_KEY,
        "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("JSearch error:", res.status, await res.text());
      return [];
    }

    const data    = await res.json();
    const results = data?.data || [];

    return results.slice(0, count).map((job: any, i: number): JobResult => {
      // Posted date
      let postedAt = "Recently";
      if (job.job_posted_at_timestamp) {
        const posted   = new Date(job.job_posted_at_timestamp * 1000);
        const diffDays = Math.floor((Date.now() - posted.getTime()) / 86400000);
        if (diffDays === 0)      postedAt = "Today";
        else if (diffDays === 1) postedAt = "Yesterday";
        else if (diffDays < 7)  postedAt = `${diffDays} days ago`;
        else if (diffDays < 14) postedAt = "1 week ago";
        else if (diffDays < 30) postedAt = `${Math.floor(diffDays/7)} weeks ago`;
        else                    postedAt = `${Math.floor(diffDays/30)} months ago`;
      } else if (job.job_posted_at_datetime_utc) {
        const posted   = new Date(job.job_posted_at_datetime_utc);
        const diffDays = Math.floor((Date.now() - posted.getTime()) / 86400000);
        if (diffDays === 0)      postedAt = "Today";
        else if (diffDays === 1) postedAt = "Yesterday";
        else if (diffDays < 7)  postedAt = `${diffDays} days ago`;
        else                    postedAt = `${Math.floor(diffDays/7)} weeks ago`;
      }

      // Job type
      const emp = (job.job_employment_type || "").toLowerCase();
      const type = emp.includes("fulltime") || emp.includes("full_time") ? "Full-time"
                 : emp.includes("parttime") || emp.includes("part_time") ? "Part-time"
                 : emp.includes("contractor") || emp.includes("contract") ? "Contract"
                 : emp.includes("intern") ? "Internship"
                 : "Full-time";

      // Salary
      let salary: string | undefined;
      if (job.job_min_salary && job.job_max_salary) {
        const curr = job.job_salary_currency || "$";
        const per  = job.job_salary_period === "YEAR" ? "/year" : job.job_salary_period === "MONTH" ? "/month" : "/month";
        salary = `${curr}${Math.round(job.job_min_salary).toLocaleString()} – ${curr}${Math.round(job.job_max_salary).toLocaleString()}${per}`;
      }

      // Source from apply link
      const applyUrl = job.job_apply_link || job.job_google_link || "#";
      let source = job.job_publisher || "Job Board";
      const urlLower = applyUrl.toLowerCase();
      if (urlLower.includes("linkedin"))    source = "LinkedIn";
      else if (urlLower.includes("indeed")) source = "Indeed";
      else if (urlLower.includes("rozee"))  source = "Rozee.pk";
      else if (urlLower.includes("glassdoor")) source = "Glassdoor";
      else if (urlLower.includes("bayt"))   source = "Bayt";
      else if (urlLower.includes("mustakbil")) source = "Mustakbil";
      else if (urlLower.includes("rozee"))  source = "Rozee.pk";
      else if (urlLower.includes("workable")) source = "Workable";
      else if (urlLower.includes("lever"))  source = "Lever";
      else if (urlLower.includes("greenhouse")) source = "Greenhouse";

      return {
        id:          job.job_id || `jsearch_${i}_${Date.now()}`,
        title:       job.job_title       || "Job Opening",
        company:     job.employer_name   || "Company",
        location:    [job.job_city, job.job_state, job.job_country].filter(Boolean).join(", ") || location,
        type,
        postedAt,
        description: job.job_description
          ? job.job_description.replace(/
+/g, " ").slice(0, 220).trim() + "..."
          : "Click Apply to view full job description.",
        applyUrl,
        source,
        salary,
      };
    });
  } catch (e) {
    console.error("JSearch fetch error:", e);
    return [];
  }
}

// ─── Step 2b: Adzuna (for supported countries, when JSearch unavailable) ──────
const ADZUNA_SUPPORTED = ["us","gb","ca","au","nz","za","de","fr","nl","pl","ru","br","in","sg"];

async function fetchAdzunaJobs(keywords: string, country: string, count: number): Promise<JobResult[]> {
  if (!ADZUNA_SUPPORTED.includes(country)) return [];
  try {
    const params = new URLSearchParams({
      app_id:           ADZUNA_APP_ID,
      app_key:          ADZUNA_APP_KEY,
      results_per_page: String(Math.min(count, 10)),
      what:             keywords,
      content_type:     "application/json",
    });
    const url  = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params}`;
    const res  = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const data    = await res.json();
    const results = data?.results || [];

    const CURRENCY: Record<string,string> = { us:"$",gb:"£",ca:"CA$",au:"AU$",de:"€",fr:"€",nl:"€",in:"₹",sg:"S$" };
    const curr = CURRENCY[country] || "$";

    return results.map((job: any, i: number): JobResult => {
      let salary: string | undefined;
      if (job.salary_min && job.salary_max) {
        salary = `${curr}${Math.round(job.salary_min).toLocaleString()} – ${curr}${Math.round(job.salary_max).toLocaleString()}/year`;
      }
      const diffDays = job.created ? Math.floor((Date.now() - new Date(job.created).getTime()) / 86400000) : 99;
      const postedAt = diffDays === 0 ? "Today" : diffDays === 1 ? "Yesterday" : diffDays < 7 ? `${diffDays} days ago` : `${Math.floor(diffDays/7)} weeks ago`;
      const emp  = (job.contract_time || job.contract_type || "").toLowerCase();
      const type = emp.includes("full") ? "Full-time" : emp.includes("part") ? "Part-time" : emp.includes("contract") ? "Contract" : "Full-time";

      return {
        id:          job.id || `adzuna_${i}_${Date.now()}`,
        title:       job.title || "Job Opening",
        company:     job.company?.display_name || "Company",
        location:    job.location?.display_name || job.location?.area?.join(", ") || "N/A",
        type, postedAt,
        description: job.description ? job.description.replace(/<[^>]*>/g,"").slice(0,220).trim() + "..." : "Click Apply to view job.",
        applyUrl:    job.redirect_url || job.adref || job.url || "#",
        source:      "Adzuna",
        salary,
      };
    });
  } catch (e) {
    console.error("Adzuna error:", e);
    return [];
  }
}

// ─── Step 2c: Direct job board links fallback (no API key needed) ─────────────
// When both JSearch and Adzuna fail, return search links to real job boards
// This always gives real links even without API keys
function buildDirectJobLinks(keywords: string, location: string, countryName: string, count: number): JobResult[] {
  const kw  = encodeURIComponent(keywords);
  const loc = encodeURIComponent(location);
  const isPakistan = countryName.includes("pakistan");
  const isUAE      = countryName.includes("uae") || countryName.includes("emirates");
  const isIndia    = countryName.includes("india");

  let boards: Array<{ name: string; url: string }> = [];

  if (isPakistan) {
    boards = [
      { name: "Rozee.pk",    url: `https://www.rozee.pk/job/jsearch/q/${kw}` },
      { name: "LinkedIn",    url: `https://www.linkedin.com/jobs/search/?keywords=${kw}&location=${loc}` },
      { name: "Mustakbil",   url: `https://www.mustakbil.com/jobs/search/?q=${kw}&l=${loc}` },
      { name: "Indeed",      url: `https://pk.indeed.com/jobs?q=${kw}&l=${loc}` },
    ];
  } else if (isUAE) {
    boards = [
      { name: "Bayt",        url: `https://www.bayt.com/en/uae/jobs/?q=${kw}` },
      { name: "LinkedIn",    url: `https://www.linkedin.com/jobs/search/?keywords=${kw}&location=${loc}` },
      { name: "GulfTalent",  url: `https://www.gulftalent.com/jobs?q=${kw}` },
      { name: "Indeed UAE",  url: `https://ae.indeed.com/jobs?q=${kw}&l=${loc}` },
    ];
  } else if (isIndia) {
    boards = [
      { name: "Naukri",      url: `https://www.naukri.com/${kw.replace(/%20/g,"-")}-jobs-in-${loc.replace(/%20/g,"-").toLowerCase()}` },
      { name: "LinkedIn",    url: `https://www.linkedin.com/jobs/search/?keywords=${kw}&location=${loc}` },
      { name: "Indeed India",url: `https://in.indeed.com/jobs?q=${kw}&l=${loc}` },
    ];
  } else {
    boards = [
      { name: "LinkedIn",    url: `https://www.linkedin.com/jobs/search/?keywords=${kw}&location=${loc}` },
      { name: "Indeed",      url: `https://www.indeed.com/jobs?q=${kw}&l=${loc}` },
      { name: "Glassdoor",   url: `https://www.glassdoor.com/Job/jobs.htm?sc.keyword=${kw}&locT=C&locId=1&typedKeyword=${kw}` },
    ];
  }

  return boards.slice(0, Math.min(count, boards.length)).map((b, i) => ({
    id:          `direct_${i}_${Date.now()}`,
    title:       `${keywords} — Search on ${b.name}`,
    company:     b.name,
    location,
    type:        "Various",
    postedAt:    "Live listings",
    description: `Click Apply to search for "${keywords}" jobs in ${location} on ${b.name}. You will see all current openings with real apply links.`,
    applyUrl:    b.url,
    source:      b.name,
  }));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatPostedDate(date: Date): string {
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7)  return `${diffDays} days ago`;
  if (diffDays < 14) return "1 week ago";
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
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

    if (planLimit === 0) {
      return NextResponse.json({ error: "Upgrade to access Job Search.", jobs: [] }, { status: 403 });
    }

    // ── DB usage check ────────────────────────────────────────────────────────
    let jobResultsUsed = 0;
    if (!isUnlimited && email) {
      const user = await db.user.findUnique({ where: { email } }).catch(() => null);
      if (user) {
        if (normalizedPlan !== "trial") {
          const lastReset   = (user as any).jobResultsResetAt ? new Date((user as any).jobResultsResetAt) : null;
          const now         = new Date();
          const shouldReset = !lastReset || now.getFullYear() > lastReset.getFullYear() || now.getMonth() > lastReset.getMonth();
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

    // ── Parse prompt ──────────────────────────────────────────────────────────
    const { keywords, location, country, countryName } = await parsePrompt(prompt.trim());
    console.log(`Parsed | keywords:"${keywords}" | location:"${location}" | country:"${country}"`);

    // ── Fetch jobs: JSearch → Adzuna → Direct links ───────────────────────────
    let jobs: JobResult[] = [];

    // 1. Try JSearch (works for Pakistan, India, UAE, everywhere)
    if (JSEARCH_API_KEY) {
      jobs = await fetchJSearchJobs(keywords, location, countToFetch);
      console.log(`JSearch returned: ${jobs.length} jobs`);
    }

    // 2. Fallback: Adzuna (US, UK, India etc.)
    if (jobs.length === 0) {
      jobs = await fetchAdzunaJobs(keywords, country, countToFetch);
      console.log(`Adzuna returned: ${jobs.length} jobs`);
    }

    // 3. Last resort: direct job board search links (always real, never fake)
    if (jobs.length === 0) {
      jobs = buildDirectJobLinks(keywords, location, countryName, countToFetch);
      console.log(`Using direct job board links: ${jobs.length}`);
    }

    console.log(`Final job count: ${jobs.length}`);

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
      total:            jobs.length,
      searchedLocation: location,
      jobResultsUsed:   isUnlimited ? null : jobResultsUsed,
      jobResultsLimit:  isUnlimited ? null : planLimit,
      limitReached:     !isUnlimited && jobResultsUsed >= planLimit,
    });

  } catch (error: any) {
    console.error("Job search error:", error);
    return NextResponse.json({ error: error.message || "Internal server error", jobs: [] }, { status: 500 });
  }
}