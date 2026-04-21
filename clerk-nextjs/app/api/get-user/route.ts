// app/api/get-user/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

    let user = await db.user.findUnique({
      where: { email },
      select: {
        id:                   true,
        email:                true,
        plan:                 true,
        subscriptionStatus:   true,
        stripeCustomerId:     true,
        stripeSubscriptionId: true,
        role:                 true,
        createdAt:            true,
        trialStartedAt:       true,
        trialEndsAt:          true,
        trialUsed:            true,
        jobResultsUsed:       true,  // ← ADD THIS
      },
    });

    // Auto-create if not found
    if (!user) {
      user = await db.user.create({
        data: {
          email,
          plan:               "free",
          subscriptionStatus: "inactive",
          role:               "user",
          trialUsed:          false,
        },
        select: {
          id:true, email:true, plan:true, subscriptionStatus:true,
          stripeCustomerId:true, stripeSubscriptionId:true, role:true,
          createdAt:true, trialStartedAt:true, trialEndsAt:true, trialUsed:true,
          jobResultsUsed:true,  // ← ADD THIS
        },
      });
    }

    // ── Trial status calculation ─────────────────────────────────────────
    const now = new Date();

    const isOnTrial = !!(
      user.trialEndsAt &&
      now < new Date(user.trialEndsAt) &&
      (user.plan === "free" || user.plan === "trial")
    );

    const isTrialExpired = !!(
      user.trialEndsAt &&
      now >= new Date(user.trialEndsAt) &&
      (user.plan === "free" || user.plan === "trial") &&
      user.subscriptionStatus !== "active"
    );

    const trialDaysLeft = isOnTrial
      ? Math.max(0, Math.ceil((new Date(user.trialEndsAt!).getTime() - now.getTime()) / (1000*60*60*24)))
      : 0;

    const canStartTrial = !user.trialUsed && !isOnTrial && user.subscriptionStatus !== "active";

    return NextResponse.json({
      ...user,
      isOnTrial,
      isTrialExpired,
      trialDaysLeft,
      canStartTrial,
      effectivePlan: isTrialExpired
        ? "expired"
        : isOnTrial
          ? "trial"
          : user.subscriptionStatus === "active"
            ? user.plan
            : "free",
    });

  } catch (error: any) {
    console.error("get-user error:", error.message);
    return NextResponse.json(
      { error: error.message, plan: "free", subscriptionStatus: "inactive", effectivePlan: "free", canStartTrial: false },
      { status: 500 }
    );
  }
}