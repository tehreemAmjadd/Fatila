import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
  const code        = req.nextUrl.searchParams.get("code");
  const clientId    = process.env.GA_OAUTH_CLIENT_ID!;
  const clientSecret= process.env.GA_OAUTH_CLIENT_SECRET!;
  const redirectUri = "https://fatilaai.com/api/admin/analytics/callback";

  if (!code) return NextResponse.json({ error: "No code" }, { status: 400 });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, client_id: clientId, client_secret: clientSecret,
      redirect_uri: redirectUri, grant_type: "authorization_code",
    }),
  });

  const tokens = await res.json();

  if (tokens.refresh_token) {
    // Save refresh token to file
    const tokenPath = path.join(process.cwd(), "ga-token.json");
    fs.writeFileSync(tokenPath, JSON.stringify(tokens));
    return NextResponse.redirect("https://fatilaai.com/dashboard?ga=connected");
  }

  return NextResponse.json({ error: "No refresh token", tokens });
}