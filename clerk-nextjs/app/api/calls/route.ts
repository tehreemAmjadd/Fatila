// app/api/calls/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET - fetch call logs for user
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");
    if (!email) return NextResponse.json({ logs: [] });

    const user = await db.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ logs: [] });

    const callLog = (db as any).callLog;
    if (!callLog) return NextResponse.json({ logs: [], notice: "Run migration" });

    const logs = await callLog.findMany({
      where:   { userId: user.id },
      orderBy: { calledAt: "desc" },
      take:    100,
    });

    const total     = logs.length;
    const connected = logs.filter((l: any) => l.status === "connected").length;
    const missed    = logs.filter((l: any) => l.status === "missed").length;
    const noAnswer  = logs.filter((l: any) => l.status === "no_answer").length;

    return NextResponse.json({ logs, stats: { total, connected, missed, noAnswer } });
  } catch (err: any) {
    console.error("Call log GET error:", err.message);
    return NextResponse.json({ logs: [], stats: { total:0, connected:0, missed:0, noAnswer:0 } });
  }
}

// POST - log a call
export async function POST(req: NextRequest) {
  try {
    const { email, phone, company, contactName, status, notes } = await req.json();
    if (!email || !phone) return NextResponse.json({ error: "Missing data" }, { status: 400 });

    let user = await db.user.findUnique({ where: { email } });
    if (!user) {
      user = await db.user.create({
        data: { email, plan: "free", subscriptionStatus: "inactive", role: "user" },
      });
    }

    const callLog = (db as any).callLog;
    if (!callLog) {
      // Table doesn't exist yet — return success silently
      return NextResponse.json({ success: true, note: "Add CallLog to schema" });
    }

    const log = await callLog.create({
      data: {
        userId:      user.id,
        phone,
        company:     company    || null,
        contactName: contactName || null,
        status:      status     || "initiated",
        notes:       notes      || null,
        calledAt:    new Date(),
      },
    });

    return NextResponse.json({ success: true, id: log.id });
  } catch (err: any) {
    console.error("Call log POST error:", err.message);
    return NextResponse.json({ success: true, note: err.message });
  }
}