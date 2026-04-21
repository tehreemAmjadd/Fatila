// app/api/jobs/search/route.ts
// Job search limits per plan:
//   trial    → 20 total (lifetime, tracked in DB)
//   starter  → 100 / month (tracked in DB, resets monthly)
//   pro      → 500 / month (tracked in DB, resets monthly)
//   business → unlimited
//   admin    → unlimited
//
// ⚠️  Requires these fields on User model in schema.prisma:
//   jobResultsUsed      Int       @default(0)
//   jobResultsResetAt   DateTime?
// Then run: npx prisma db push

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

const PLAN_JOB_LIMITS: Record<string, number> = {
  trial:    20,
  starter:  100,
  pro:      500,
  business: Infinity,
};

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

// ─── OpenAI generator ─────────────────────────────────────────────────────────

async function generateJobResults(prompt: string, count: number): Promise<JobResult[]> {
  const today = new Date().toISOString().split("T")[0];

  const systemPrompt = `You are a job search assistant. Return exactly ${count} realistic, currently-available job listings matching the user's query.

Today's date is ${today}.

For each listing:
- Use real company names (e.g. Devsinc, Systems Ltd, NetSol, MTBC, Folio3, Arbisoft, 10Pearls, Careem, Daraz, i2c for Pakistan tech roles)
- Apply URLs:
  * LinkedIn:  https://www.linkedin.com/jobs/search/?keywords=JOBTITLE+COMPANY
  * Indeed:    https://pk.indeed.com/jobs?q=JOBTITLE+COMPANY&l=LOCATION
  * Rozee:     https://www.rozee.pk/job/jsearch/q/JOBTITLE
  * Glassdoor: https://www.glassdoor.com/Job/jobs.htm?sc.keyword=JOBTITLE+COMPANY
- postedAt: "Today", "2 days ago", "3 days ago", "1 week ago"
- type: "Full-time" | "Remote" | "Hybrid" | "Contract" | "Part-time"
- description: 1-2 sentences, role + key requirements
- salary: estimate if possible (e.g. "PKR 150K–250K/month"), else omit
- source: "LinkedIn" | "Indeed" | "Rozee.pk" | "Glassdoor" | "Bayt"

Return ONLY a valid JSON array. No markdown, no code fences.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
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

  if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);

  const data  = await res.json();
  const raw   = data.choices?.[0]?.message?.content?.trim() || "[]";
  const clean = raw.replace(/```json|```/g, "").trim();

  let jobs: JobResult[] = [];
  try {
    jobs = JSON.parse(clean);
    if (!Array.isArray(jobs)) jobs = [];
  } catch { jobs = []; }

  return jobs.map((job, i) => ({ ...job, id: job.id || `job_${Date.now()}_${i}` }));
}

// ─── POST Handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY missing", jobs: [] }, { status: 500 });
    }

    const { prompt, email, plan = "free" } = await req.json();

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Please provide a job search prompt.", jobs: [] }, { status: 400 });
    }

    const planLimit = PLAN_JOB_LIMITS[plan] ?? 0;

    // ── Unlimited plans (business / admin) — skip all tracking ───────────────
    if (planLimit === Infinity) {
      const jobs = await generateJobResults(prompt.trim(), 10);
      return NextResponse.json({ jobs, total: jobs.length, jobResultsUsed: null, jobResultsLimit: null, limitReached: false });
    }

    // ── Free / unknown plan — blocked ─────────────────────────────────────────
    if (planLimit === 0) {
      return NextResponse.json({ error: "Upgrade to access Job Search.", jobs: [] }, { status: 403 });
    }

    // ── Limited plans (trial / starter / pro) — check DB usage ───────────────
    let jobResultsUsed = 0;

    if (email) {
      const user = await db.user.findUnique({ where: { email } }).catch(() => null);

      if (user) {
        // Monthly reset for starter / pro (not trial — trial is lifetime)
        if (plan !== "trial") {
          const resetAt  = (user as any).jobResultsResetAt;
          const now      = new Date();
          const lastReset = resetAt ? new Date(resetAt) : null;
          const shouldReset = !lastReset || (
            now.getFullYear() > lastReset.getFullYear() ||
            now.getMonth()    > lastReset.getMonth()
          );

          if (shouldReset) {
            // Reset count for new billing month
            await db.user.update({
              where: { email },
              data: { jobResultsUsed: 0, jobResultsResetAt: now } as any,
            }).catch(() => {});
            jobResultsUsed = 0;
          } else {
            jobResultsUsed = (user as any).jobResultsUsed ?? 0;
          }
        } else {
          jobResultsUsed = (user as any).jobResultsUsed ?? 0;
        }

        // Hard block if at limit
        if (jobResultsUsed >= planLimit) {
          return NextResponse.json({
            jobs: [], total: 0,
            jobResultsUsed,
            jobResultsLimit: planLimit,
            limitReached: true,
          }, { status: 403 });
        }
      }
    }

    // ── Fetch only remaining quota (max 10 per search) ────────────────────────
    const remaining    = planLimit - jobResultsUsed;
    const countToFetch = Math.min(10, remaining);

    console.log(`🔍 Job search | plan:${plan} | used:${jobResultsUsed}/${planLimit} | fetching:${countToFetch}`);

    const jobs = await generateJobResults(prompt.trim(), countToFetch);

    // ── Increment usage in DB ─────────────────────────────────────────────────
    if (email && jobs.length > 0) {
      await db.user.update({
        where: { email },
        data: { jobResultsUsed: { increment: jobs.length } } as any,
      }).catch((e: any) => console.error("Failed to update jobResultsUsed:", e));

      jobResultsUsed += jobs.length;
    }

    return NextResponse.json({
      jobs,
      total:           jobs.length,
      jobResultsUsed,
      jobResultsLimit: planLimit,
      limitReached:    jobResultsUsed >= planLimit,
    });

  } catch (error: any) {
    console.error("Job search error:", error);
    return NextResponse.json({ error: error.message || "Internal server error", jobs: [] }, { status: 500 });
  }
}