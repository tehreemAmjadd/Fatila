import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const PROPERTY_ID  = "528401128";
const TOKEN_FILE   = path.join(process.cwd(), "ga-token.json");

async function getAccessToken(): Promise<string> {
  const clientId     = process.env.GA_OAUTH_CLIENT_ID!;
  const clientSecret = process.env.GA_OAUTH_CLIENT_SECRET!;

  if (!fs.existsSync(TOKEN_FILE)) {
    throw new Error("Not authorized. Visit /api/admin/analytics/auth to connect Google Analytics.");
  }

  const tokens       = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8"));
  const refreshToken = tokens.refresh_token;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId, client_secret: clientSecret,
      refresh_token: refreshToken, grant_type: "refresh_token",
    }),
  });

  const data = await res.json();
  if (!data.access_token) throw new Error("Failed to refresh token");
  return data.access_token;
}

async function gaReport(token: string, body: object) {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}:runReport`,
    { method:"POST", headers:{ "Content-Type":"application/json", Authorization:`Bearer ${token}` }, body: JSON.stringify(body) }
  );
  return res.json();
}

async function gaRealtime(token: string, body: object) {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}:runRealtimeReport`,
    { method:"POST", headers:{ "Content-Type":"application/json", Authorization:`Bearer ${token}` }, body: JSON.stringify(body) }
  );
  return res.json();
}

export async function GET() {
  try {
    const token = await getAccessToken();

    const [usersRes, sourcesRes, countriesRes, realtimeRes] = await Promise.all([
      gaReport(token, {
        dateRanges: [{ startDate:"7daysAgo", endDate:"today" }],
        metrics: [{ name:"totalUsers" },{ name:"newUsers" },{ name:"sessions" },{ name:"screenPageViews" }],
      }),
      gaReport(token, {
        dateRanges: [{ startDate:"7daysAgo", endDate:"today" }],
        dimensions: [{ name:"sessionDefaultChannelGroup" }],
        metrics: [{ name:"sessions" }],
        orderBys: [{ metric:{ metricName:"sessions" }, desc:true }],
        limit: 6,
      }),
      gaReport(token, {
        dateRanges: [{ startDate:"7daysAgo", endDate:"today" }],
        dimensions: [{ name:"country" }],
        metrics: [{ name:"activeUsers" }],
        orderBys: [{ metric:{ metricName:"activeUsers" }, desc:true }],
        limit: 8,
      }),
      gaRealtime(token, { metrics: [{ name:"activeUsers" }] }),
    ]);

    const uRow       = usersRes.rows?.[0]?.metricValues || [];
    const totalUsers = Number(uRow[0]?.value || 0);
    const newUsers   = Number(uRow[1]?.value || 0);
    const sessions   = Number(uRow[2]?.value || 0);
    const pageViews  = Number(uRow[3]?.value || 0);

    const trafficSources = (sourcesRes.rows || []).map((r: any) => ({
      source: r.dimensionValues?.[0]?.value || "Unknown",
      sessions: Number(r.metricValues?.[0]?.value || 0),
    }));

    const topCountries = (countriesRes.rows || []).map((r: any) => ({
      country: r.dimensionValues?.[0]?.value || "Unknown",
      users: Number(r.metricValues?.[0]?.value || 0),
    }));

    const activeUsers = Number(realtimeRes.rows?.[0]?.metricValues?.[0]?.value || 0);

    return NextResponse.json({ totalUsers, newUsers, sessions, pageViews, activeUsers, trafficSources, topCountries });

  } catch (error: any) {
    console.error("GA error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}