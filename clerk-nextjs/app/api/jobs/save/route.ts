// app/api/jobs/save/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { email, job } = await req.json();
    if (!email || !job) return NextResponse.json({ error: "email and job required" }, { status: 400 });

    let user = await db.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Upsert so duplicate saves don't error
    await (db as any).savedJob.upsert({
      where:  { userId_jobId: { userId: user.id, jobId: job.id } },
      update: {},
      create: {
        userId:      user.id,
        jobId:       job.id,
        title:       job.title       || "",
        company:     job.company     || "",
        location:    job.location    || "",
        type:        job.type        || "",
        postedAt:    job.postedAt    || "",
        description: job.description || "",
        applyUrl:    job.applyUrl    || "#",
        source:      job.source      || "",
        salary:      job.salary      || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Save job error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { email, savedJobId } = await req.json();
    if (!email || !savedJobId) return NextResponse.json({ error: "email and savedJobId required" }, { status: 400 });

    const user = await db.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    await (db as any).savedJob.delete({ where: { id: savedJobId } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete saved job error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");
    if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

    const user = await db.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ savedJobs: [] });

    const savedJobs = await (db as any).savedJob.findMany({
      where:   { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ savedJobs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}