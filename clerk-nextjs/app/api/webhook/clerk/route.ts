// app/api/webhooks/clerk/route.ts
// This creates users in your DB when they sign up via Clerk

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { Webhook } from "svix";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    console.error("CLERK_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Server config error" }, { status: 500 });
  }

  const headersList = await headers();
  const svix_id        = headersList.get("svix-id");
  const svix_timestamp = headersList.get("svix-timestamp");
  const svix_signature = headersList.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
  }

  const body = await req.text();
  const wh = new Webhook(WEBHOOK_SECRET);
  let event: any;

  try {
    event = wh.verify(body, { "svix-id": svix_id, "svix-timestamp": svix_timestamp, "svix-signature": svix_signature });
  } catch (err) {
    console.error("Webhook verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const { type, data } = event;

  if (type === "user.created") {
    const email = data.email_addresses?.[0]?.email_address;
    const clerkId = data.id;

    if (email) {
      try {
        await db.user.upsert({
          where: { email },
          update: { clerkId },
          create: {
            email,
            clerkId,
            plan: "free",
            subscriptionStatus: "inactive",
            role: "user",
          },
        });
        console.log("✅ User created in DB:", email);
      } catch (err) {
        console.error("❌ DB user creation error:", err);
      }
    }
  }

  if (type === "user.updated") {
    const email = data.email_addresses?.[0]?.email_address;
    const clerkId = data.id;

    if (email && clerkId) {
      await db.user.upsert({
        where: { clerkId },
        update: { email },
        create: { email, clerkId, plan: "free", subscriptionStatus: "inactive" },
      }).catch(console.error);
    }
  }

  return NextResponse.json({ received: true });
}
