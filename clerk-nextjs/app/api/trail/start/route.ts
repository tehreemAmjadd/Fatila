// app/api/trial/start/route.ts
// Called when user clicks "Start Free Trial" button
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

    const user = await db.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Guard: only allow if trial not used before and not already subscribed
    if (user.trialUsed) {
      return NextResponse.json({ error: "Trial already used" }, { status: 400 });
    }
    if (user.subscriptionStatus === "active") {
      return NextResponse.json({ error: "Already on a paid plan" }, { status: 400 });
    }

    const now   = new Date();
    const end   = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 days

    const updated = await db.user.update({
      where: { email },
      data: {
        plan:              "trial",
        trialStartedAt:    now,
        trialEndsAt:       end,
        trialUsed:         true,       // can never start a trial again
        subscriptionStatus:"trialing",
      },
    });

    console.log(`✅ Trial started for ${email} — expires ${end.toISOString()}`);

    return NextResponse.json({
      success:       true,
      trialEndsAt:   end,
      trialDaysLeft: 7,
      message:       "7-day free trial activated!",
    });

  } catch (error: any) {
    console.error("Trial start error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
