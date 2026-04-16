// app/api/meta-ads/launch/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const META_API_VERSION = "v18.0";
const META_BASE        = `https://graph.facebook.com/${META_API_VERSION}`;

async function metaApi(endpoint: string, method: string, params: any, token: string) {
  const isGet = method === "GET";
  const url   = isGet
    ? `${META_BASE}/${endpoint}?${new URLSearchParams({ ...params, access_token: token })}`
    : `${META_BASE}/${endpoint}`;

  const res = await fetch(url, {
    method,
    headers: isGet ? undefined : { "Content-Type": "application/json" },
    body:    isGet ? undefined : JSON.stringify({ ...params, access_token: token }),
  });

  const data = await res.json();
  if (data.error) {
    console.error("Meta API Full Error:", JSON.stringify(data.error, null, 2));
    const details = data.error.error_data ? JSON.stringify(data.error.error_data) : "";
    throw new Error(`${data.error.message} (code: ${data.error.code}) ${details}`);
  }
  return data;
}

export async function POST(req: NextRequest) {
  try {
    const {
      email, adAccountId, accessToken, campaignName,
      objective, primaryText, headline, callToAction,
      imageUrl, dailyBudget, durationDays,
      targetLocations, targetAgeMin, targetAgeMax,
      websiteUrl, pageId,
    } = await req.json();

    if (!adAccountId || !accessToken) {
      return NextResponse.json({ error: "Ad Account ID and Access Token required", needsConnect: true }, { status: 400 });
    }

    const cleanId   = adAccountId.toString().replace("act_", "");
    const accountId = `act_${cleanId}`;

    // ── Verify token ─────────────────────────────────────────────────────
    try {
      const me = await metaApi("me", "GET", { fields: "id,name" }, accessToken);
      console.log("✅ Token valid:", me.name);
    } catch {
      return NextResponse.json({
        error: "❌ Invalid Access Token. Go to developers.facebook.com/tools/explorer/ → Generate new token with ads_management permission.",
        needsConnect: true,
      }, { status: 401 });
    }

    // ── Get Page ID ───────────────────────────────────────────────────────
    let resolvedPageId = pageId;
    if (!resolvedPageId) {
      try {
        const pages = await metaApi("me/accounts", "GET", { fields: "id,name" }, accessToken);
        if (pages.data?.length > 0) {
          resolvedPageId = pages.data[0].id;
          console.log("✅ Auto Page ID:", resolvedPageId);
        }
      } catch { /* ignore */ }
    }

    if (!resolvedPageId) {
      return NextResponse.json({
        error: "❌ Facebook Page ID needed. Create a Facebook Page first → go to facebook.com → Pages → Create Page → copy Page ID from About section.",
      }, { status: 400 });
    }

    // ── Campaign ──────────────────────────────────────────────────────────
    const campaign = await metaApi(`${accountId}/campaigns`, "POST", {
      name:                       campaignName || "LeadVision Ad",
      objective:                  "OUTCOME_TRAFFIC",
      status:                     "PAUSED",
      special_ad_categories:      [],
      is_adset_budget_sharing_enabled: false,
    }, accessToken);

    // ── Country codes ─────────────────────────────────────────────────────
    const CODE_MAP: Record<string, string> = {
      pakistan:"PK", pk:"PK", uae:"AE", dubai:"AE",
      usa:"US", us:"US", uk:"GB", india:"IN", in:"IN",
      canada:"CA", australia:"AU", "saudi arabia":"SA",
    };
    const locations   = targetLocations?.length ? targetLocations : ["Pakistan"];
    const countryCodes = [...new Set(locations.map((l: string) =>
      CODE_MAP[l.toLowerCase()] || (l.length === 2 ? l.toUpperCase() : "PK")
    ))];

    // ── Ad Set ────────────────────────────────────────────────────────────
    const now     = Math.floor(Date.now() / 1000);
    const adSet   = await metaApi(`${accountId}/adsets`, "POST", {
      name:              `${campaignName} - Set`,
      campaign_id:       campaign.id,
      daily_budget:      Math.max(Math.round(Number(dailyBudget || 10) * 100), 100),
      start_time:        now + 300,
      end_time:          now + (Number(durationDays || 7) * 86400),
      billing_event:     "IMPRESSIONS",
      optimization_goal: "LINK_CLICKS",
      bid_strategy:      "LOWEST_COST_WITHOUT_CAP",
      targeting: {
        age_min:       Number(targetAgeMin) || 18,
        age_max:       Number(targetAgeMax) || 65,
        geo_locations: { countries: countryCodes },
      },
      status: "PAUSED",
    }, accessToken);

    // ── Creative ──────────────────────────────────────────────────────────
    const linkData: any = {
      message:        primaryText || "Check out our offer!",
      link:           websiteUrl || `https://www.facebook.com/${resolvedPageId}`,
      name:           headline   || campaignName,
      call_to_action: { type: callToAction || "LEARN_MORE" },
    };
    if (imageUrl?.startsWith("http")) linkData.picture = imageUrl;

    const creative = await metaApi(`${accountId}/adcreatives`, "POST", {
      name:               `${campaignName} - Creative`,
      object_story_spec:  { page_id: resolvedPageId, link_data: linkData },
    }, accessToken);

    // ── Ad ────────────────────────────────────────────────────────────────
    const ad = await metaApi(`${accountId}/ads`, "POST", {
      name:     `${campaignName} - Ad`,
      adset_id: adSet.id,
      creative: { creative_id: creative.id },
      status:   "PAUSED",
    }, accessToken);

    // Save to DB
    if (email) {
      try {
        const user = await db.user.findUnique({ where: { email } });
        if (user) await (db as any).adCampaign?.create({
          data: { userId:user.id, campaignId:campaign.id, adSetId:adSet.id, adId:ad.id, name:campaignName, status:"paused", budget:Number(dailyBudget), platform:"meta" },
        }).catch(() => {});
      } catch { /* ignore */ }
    }

    return NextResponse.json({
      success:    true,
      message:    "✅ Campaign created! Status: PAUSED — review in Meta Ads Manager then activate.",
      campaignId: campaign.id,
      adSetId:    adSet.id,
      adId:       ad.id,
      reviewUrl:  "https://adsmanager.facebook.com/",
    });

  } catch (error: any) {
    console.error("❌ Launch error:", error.message);
    let msg = error.message;
    if (msg.includes("190"))  msg = "❌ Access Token invalid/expired. Generate new token from Graph API Explorer.";
    if (msg.includes("100"))  msg = "❌ Invalid parameter. Check Ad Account ID (numbers only) and Page ID.";
    if (msg.includes("200"))  msg = "❌ Missing permission. Add ads_management when generating token.";
    if (msg.includes("275"))  msg = "❌ Add a payment method in Meta Ads Manager first.";
    if (msg.includes("368"))  msg = "❌ Ad account is restricted. Check Meta Ads Manager for account status.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}