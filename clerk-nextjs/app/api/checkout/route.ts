export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});

export async function POST(req: Request) {
  try {
const { priceId, userId, plan, userEmail } = await req.json();
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    console.log("BASE URL:", baseUrl);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [
        { price: priceId, quantity: 1 },
      ],
      success_url: `${baseUrl}/success`,
      cancel_url: `${baseUrl}/billing`,
        customer_email: userEmail,

      metadata: {
        userId, // Clerk user ID
        plan,   // plan name: "pro", "starter", "business"
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Stripe Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}