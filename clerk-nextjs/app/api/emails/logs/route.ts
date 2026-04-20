// app/api/emails/logs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

async function handleLogs(email: string) {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({
      logs: [],
      stats: { total:0, sent:0, failed:0, deliveryRate:0, openRate:0 },
    });
  }

  const emailLogModel = (db as any).emailLog;

  if (!emailLogModel) {
    console.warn("EmailLog model not found — run: npx prisma migrate dev --name add_email_log");
    return NextResponse.json({
      logs: [],
      stats: { total:0, sent:0, failed:0, deliveryRate:0, openRate:0 },
      notice: "Run: npx prisma migrate dev --name add_email_log",
    });
  }

  const logs = await emailLogModel.findMany({
    where:   { userId: user.id },
    orderBy: { sentAt: "desc" },
    take:    100,
  });

  const total    = logs.length;
  const sent     = logs.filter((l: any) => l.status === "sent").length;
  const failed   = logs.filter((l: any) => l.status === "failed").length;
  const thisWeek = logs.filter((l: any) => {
    const d = new Date(l.sentAt);
    const now = new Date();
    const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 7;
  }).length;

  return NextResponse.json({
    logs,
    stats: {
      total, sent, failed, thisWeek,
      deliveryRate: total > 0 ? Math.round((sent / total) * 100) : 0,
      openRate: 0,
    },
  });
}

// ── GET — frontend query param se ─────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });
    return await handleLogs(email);
  } catch (error: any) {
    console.error("Email logs error:", error);
    return NextResponse.json({ logs: [], stats: { total:0, sent:0, failed:0, deliveryRate:0, openRate:0 } });
  }
}

// ── POST — JSON body se ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = body.email;
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });
    return await handleLogs(email);
  } catch (error: any) {
    console.error("Email logs error:", error);
    return NextResponse.json({ logs: [], stats: { total:0, sent:0, failed:0, deliveryRate:0, openRate:0 } });
  }
}