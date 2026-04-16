// app/api/meta-ads/connect/route.ts
// Handles Meta OAuth flow - user connects their Facebook Ad Account

import { NextRequest, NextResponse } from "next/server";

const META_APP_ID     = process.env.META_APP_ID     || "";
const META_APP_SECRET = process.env.META_APP_SECRET || "";
const BASE_URL        = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

// Step 1: Generate OAuth URL for user to connect Facebook
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email") || "";

    if (!META_APP_ID) {
      return NextResponse.json({
        error: "META_APP_ID not configured in .env",
        setupRequired: true,
      }, { status: 400 });
    }

    const redirectUri = encodeURIComponent(`${BASE_URL}/api/meta-ads/callback`);
    const state       = encodeURIComponent(JSON.stringify({ email }));

    // Permissions needed for running ads
    const scope = [
      "ads_management",
      "ads_read",
      "business_management",
      "pages_read_engagement",
      "instagram_basic",
    ].join(",");

    const oauthUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${redirectUri}&state=${state}&scope=${scope}&response_type=code`;

    return NextResponse.json({ oauthUrl, setupRequired: !META_APP_ID });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
