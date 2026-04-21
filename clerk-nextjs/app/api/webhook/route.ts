import Stripe from "stripe";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db"; // Prisma 7 runtime client

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});

export async function POST(req: Request) {
  console.log("🔥 WEBHOOK HIT");

  const body = await req.text();
  const sig = (await headers()).get("stripe-signature")!;
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed.", err);
    return NextResponse.json({ error: "Webhook error" }, { status: 400 });
  }

  // ✅ Handle checkout session completed
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const userId = session.metadata?.userId || session.customer_email;
    const plan = session.metadata?.plan;
    const email = session.customer_email || "unknown@example.com";

    console.log("User ID from Stripe metadata:", userId);
    console.log("Plan from Stripe metadata:", plan);
    console.log("Customer email from Stripe:", email);

    if (userId && plan) {
      try {
        const updatedUser = await db.user.upsert({
          where: { email: email },
          update: {
            plan: plan,
            subscriptionStatus: "active",
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
          },
          create: {
            email: email,
            plan: plan,
            subscriptionStatus: "active",
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
          },
        });
        console.log("✅ User subscription updated/created in DB:", updatedUser);
      } catch (dbErr) {
        console.error("❌ Error updating/creating user in DB:", dbErr);
      }
    } else {
      console.warn("⚠ Missing userId or plan in Stripe metadata.");
    }
  }

  // ✅ Handle subscription updates (upgrade, downgrade, cancel)
  if (event.type === "customer.subscription.updated") {
    const subscription = event.data.object as Stripe.Subscription;

    try {
      const user = await db.user.findFirst({
        where: { stripeCustomerId: subscription.customer as string },
      });

      if (user) {
       const PRICE_PLAN_MAP: any = {
  "price_1TOEmb2UPbx90aHbwl2mc2Zt": "starter",
  "price_1TOEma2UPbx90aHbSWNWaevl": "pro",
  "price_1TOEmd2UPbx90aHbWxNaqJPa": "business",
};

const priceId = subscription.items.data[0].price.id;
const plan = PRICE_PLAN_MAP[priceId];

        await db.user.update({
          where: { id: user.id },
          data: {
            plan: plan,
            subscriptionStatus: subscription.status, // active, canceled, past_due
          },
        });
        console.log("✅ Subscription updated via webhook for user:", user.email);
      } else {
        console.warn(
          "⚠ User not found in DB for subscription update:",
          subscription.customer
        );
      }
    } catch (err) {
      console.error("❌ Error updating subscription in DB:", err);
    }
  }

  return NextResponse.json({ received: true });
}