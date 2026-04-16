import { NextRequest } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});
export async function POST(req: NextRequest) {
  const { email, newPriceId } = await req.json();

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || !user.stripeSubscriptionId) {
    return new Response("User or subscription not found", { status: 404 });
  }

  // 🔥 Stripe update
  const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);

  await stripe.subscriptions.update(user.stripeSubscriptionId, {
    items: [
      {
        id: subscription.items.data[0].id,
        price: newPriceId,
      },
    ],
    proration_behavior: "create_prorations",
  });

  // 🔥 PLAN MAPPING (FIX)
  const PRICE_PLAN_MAP: any = {
    "price_1TGxXyFE3BY4oFrRoLc9B1d1": "starter",
    "price_1TGxaBFE3BY4oFrR3uXGtOXa": "pro",
    "price_1TGxaZFE3BY4oFrRcA9BPQLq": "business",
  };

  const plan = PRICE_PLAN_MAP[newPriceId];

  if (!plan) {
    return new Response("Invalid price ID", { status: 400 });
  }

  // 🔥 DB update
  // await prisma.user.update({
  //   where: { id: user.id },
  //   data: {
  //     plan: plan,
  //   },
  // });

  return new Response(JSON.stringify({ success: true }), { status: 200 });
}