// app/api/jobs/search/route.ts
// Uses OpenAI gpt-4o-mini to generate job listings.
// Trial users: max 20 TOTAL job results across ALL searches (tracked in DB).
// Paid users: unlimited.
//
// ⚠️  Requires this field on your User model in schema.prisma:
//   jobResultsUsed  Int  @default(0)
// Then run: npx prisma db push

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

const TRIAL_JOB_LIMIT = 20; // total results allowed for trial users across all searches

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── OpenAI job generator ─────────────────────────────────────────────────────

async function generateJobResults(prompt: string, count: number): Promise<JobResult[]> {
  const today = new Date().toISOString().split("T")[0];

  const systemPrompt = `You are a job search assistant. A user will describe the type of job they are looking for.
Your task is to return a JSON array of realistic, currently-available job listings that match their query.

Today's date is ${today}.

Return exactly ${count} job listings (or fewer only if the query is extremely niche).

For each job listing:
- Use real company names known to hire for this role (e.g. Devsinc, Systems Ltd, NetSol, MTBC, Folio3, Arbisoft, 10Pearls, Careem, Daraz, i2c for Pakistan tech jobs)
- Construct apply URLs using these patterns:
  * LinkedIn:  https://www.linkedin.com/jobs/search/?keywords=JOBTITLE+COMPANY
  * Indeed:    https://pk.indeed.com/jobs?q=JOBTITLE+COMPANY&l=LOCATION
  * Rozee:     https://www.rozee.pk/job/jsearch/q/JOBTITLE
  * Glassdoor: https://www.glassdoor.com/Job/jobs.htm?sc.keyword=JOBTITLE+COMPANY
- Set postedAt to realistic values: "Today", "2 days ago", "3 days ago", "1 week ago"
- Set type to one of: "Full-time", "Remote", "Hybrid", "Contract", "Part-time"
- description: 1-2 sentences describing role and key requirements
- salary: include if estimable (e.g. "PKR 150K–250K/month"), else omit
- source: "LinkedIn", "Indeed", "Rozee.pk", "Glassdoor", or "Bayt"

Return ONLY a valid JSON array. No markdown, no explanation, no code fences.

Example:
[
  {
    "id": "job_001",
    "title": "Senior React Developer",
    "company": "Devsinc",
    "location": "Lahore, Pakistan",
    "type": "Hybrid",
    "postedAt": "2 days ago",
    "description": "Build scalable web apps using React and Node.js. 3+ years experience required.",
    "applyUrl": "https://www.linkedin.com/jobs/search/?keywords=Senior+React+Developer+Devsinc",
    "source": "LinkedIn",
    "salary": "PKR 200K–350K/month"
  }
]`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 2500,
      temperature: 0.7,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error: ${res.status} — ${err}`);
  }

  const data  = await res.json();
  const raw   = data.choices?.[0]?.message?.content?.trim() || "[]";
  const clean = raw.replace(/```json|```/g, "").trim();

  let jobs: JobResult[] = [];
  try {
    jobs = JSON.parse(clean);
    if (!Array.isArray(jobs)) jobs = [];
  } catch {
    console.error("Failed to parse OpenAI job response:", clean);
    jobs = [];
  }

  return jobs.map((job, i) => ({
    ...job,
    id: job.id || `job_${Date.now()}_${i}`,
  }));
}

// ─── POST Handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY missing in .env", jobs: [] },
        { status: 500 }
      );
    }

    const { prompt, email, isTrial = false } = await req.json();

    if (!prompt || !String(prompt).trim()) {
      return NextResponse.json(
        { error: "Please provide a job search prompt.", jobs: [] },
        { status: 400 }
      );
    }

    // ── For trial users: check cumulative usage from DB ───────────────────────
    let jobResultsUsed = 0;

    if (isTrial && email) {
      const user = await db.user.findUnique({ where: { email } }).catch(() => null);
      if (user) {
        jobResultsUsed = (user as any).jobResultsUsed ?? 0;

        // Hard block if already at or over limit
        if (jobResultsUsed >= TRIAL_JOB_LIMIT) {
          return NextResponse.json({
            jobs: [],
            total: 0,
            jobResultsUsed,
            jobResultsLimit: TRIAL_JOB_LIMIT,
            limitReached: true,
          }, { status: 403 });
        }
      }
    }

    // ── Determine how many results to generate this search ────────────────────
    let countToFetch = 10; // default per search for paid/admin
    if (isTrial) {
      const remaining = TRIAL_JOB_LIMIT - jobResultsUsed;
      // Fetch only what's left (max 10 per search)
      countToFetch = Math.min(10, remaining);
    }

    console.log(`🔍 Job search | trial:${isTrial} | used:${jobResultsUsed}/${TRIAL_JOB_LIMIT} | fetching:${countToFetch}`);

    const jobs = await generateJobResults(String(prompt).trim(), countToFetch);

    // ── For trial users: increment cumulative count in DB ─────────────────────
    if (isTrial && email && jobs.length > 0) {
      await db.user.update({
        where: { email },
        data: { jobResultsUsed: { increment: jobs.length } } as any,
      }).catch((e: any) => console.error("Failed to update jobResultsUsed:", e));

      jobResultsUsed += jobs.length;
    }

    console.log(`✅ Returned ${jobs.length} job listings | total used: ${jobResultsUsed}`);

    return NextResponse.json({
      jobs,
      total: jobs.length,
      jobResultsUsed,
      jobResultsLimit: isTrial ? TRIAL_JOB_LIMIT : null,
      limitReached: isTrial && jobResultsUsed >= TRIAL_JOB_LIMIT,
    });

  } catch (error: any) {
    console.error("Job search error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error", jobs: [] },
      { status: 500 }
    );
  }
}