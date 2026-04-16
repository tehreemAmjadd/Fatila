import { NextRequest } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});
export async function POST(req: NextRequest) {
  const body = await req.json();
  console.log("BODY:", body);

  const { email } = body;

  if (!email) {
    return new Response("Email missing", { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || !user.stripeSubscriptionId) {
    return new Response("User or subscription not found", { status: 404 });
  }

  await stripe.subscriptions.cancel(user.stripeSubscriptionId);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      subscriptionStatus: "canceled",
    },
  });

  return new Response(JSON.stringify({ success: true }), { status: 200 });
}