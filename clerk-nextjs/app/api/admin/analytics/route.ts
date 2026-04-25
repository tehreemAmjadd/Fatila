import { NextResponse } from "next/server";
import { google } from "googleapis";
import path from "path";

const PROPERTY_ID = "528401128";
const KEY_FILE    = path.join(process.cwd(), "ga-credentials.json");

export async function GET() {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: KEY_FILE,
      scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
    });

    const analyticsData = google.analyticsdata({ version: "v1beta", auth });

    const [usersRes, sourcesRes, countriesRes, realtimeRes] = await Promise.all([
      analyticsData.properties.runReport({
        property: `properties/${PROPERTY_ID}`,
        requestBody: {
          dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
          metrics: [
            { name: "totalUsers" },
            { name: "newUsers" },
            { name: "sessions" },
            { name: "screenPageViews" },
          ],
        },
      }),
      analyticsData.properties.runReport({
        property: `properties/${PROPERTY_ID}`,
        requestBody: {
          dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
          dimensions: [{ name: "sessionDefaultChannelGroup" }],
          metrics: [{ name: "sessions" }],
          orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
          limit: 6,
        },
      }),
      analyticsData.properties.runReport({
        property: `properties/${PROPERTY_ID}`,
        requestBody: {
          dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
          dimensions: [{ name: "country" }],
          metrics: [{ name: "activeUsers" }],
          orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
          limit: 8,
        },
      }),
      analyticsData.properties.runRealtimeReport({
        property: `properties/${PROPERTY_ID}`,
        requestBody: {
          metrics: [{ name: "activeUsers" }],
        },
      }),
    ]);

    const uRow      = usersRes.data.rows?.[0]?.metricValues || [];
    const totalUsers = Number(uRow[0]?.value || 0);
    const newUsers   = Number(uRow[1]?.value || 0);
    const sessions   = Number(uRow[2]?.value || 0);
    const pageViews  = Number(uRow[3]?.value || 0);

    const trafficSources = (sourcesRes.data.rows || []).map((row: any) => ({
      source:   row.dimensionValues?.[0]?.value || "Unknown",
      sessions: Number(row.metricValues?.[0]?.value || 0),
    }));

    const topCountries = (countriesRes.data.rows || []).map((row: any) => ({
      country: row.dimensionValues?.[0]?.value || "Unknown",
      users:   Number(row.metricValues?.[0]?.value || 0),
    }));

    const activeUsers = Number(
      realtimeRes.data.rows?.[0]?.metricValues?.[0]?.value || 0
    );

    return NextResponse.json({
      totalUsers, newUsers, sessions, pageViews,
      activeUsers, trafficSources, topCountries,
    });

  } catch (error: any) {
    console.error("GA error:", error?.message);
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}