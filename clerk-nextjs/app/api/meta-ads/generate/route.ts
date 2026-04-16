// app/api/meta-ads/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const {
      productDescription,
      imageUrl,
      budget,
      duration,
      targetLocation,
      targetAudience,
      objective,
      productCategory,
      userEmail,
    } = await req.json();

    if (!productDescription) {
      return NextResponse.json({ error: "Product description required" }, { status: 400 });
    }

    const prompt = `You are a Meta (Facebook/Instagram) ads expert with 10+ years of experience creating high-converting ad campaigns.

Create a complete, ready-to-use Meta Ad campaign for this product:

PRODUCT INFO:
- Description: ${productDescription}
- Category: ${productCategory || "General"}
- Target Location: ${targetLocation || "Worldwide"}
- Target Audience: ${targetAudience || "General audience"}
- Daily Budget: $${budget || 10}
- Duration: ${duration || 7} days
- Objective: ${objective || "Sales"}

Generate a complete Meta Ad campaign in this EXACT JSON format (respond ONLY with valid JSON, no markdown, no explanation):

{
  "campaignName": "string - catchy campaign name",
  "objective": "string - OUTCOME_SALES or OUTCOME_TRAFFIC or OUTCOME_AWARENESS or OUTCOME_LEADS",
  "primaryHeadline": "string - main ad headline (max 40 chars)",
  "secondaryHeadline": "string - second headline (max 40 chars)",
  "primaryText": "string - main ad body text (max 125 chars, emotional, benefit-focused)",
  "description": "string - additional description (max 30 chars)",
  "callToAction": "string - one of: SHOP_NOW, LEARN_MORE, SIGN_UP, GET_OFFER, BOOK_NOW, CONTACT_US, ORDER_NOW",
  "targetingAge": { "min": number, "max": number },
  "targetingInterests": ["interest1", "interest2", "interest3", "interest4", "interest5"],
  "targetingBehaviors": ["behavior1", "behavior2"],
  "targetingLocations": ["location1", "location2"],
  "adFormats": ["IMAGE", "VIDEO", "CAROUSEL"],
  "recommendedBudget": number,
  "estimatedReachMin": number,
  "estimatedReachMax": number,
  "estimatedClicksMin": number,
  "estimatedClicksMax": number,
  "tips": ["tip1", "tip2", "tip3"],
  "hashtagSuggestions": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
  "alternativeHeadlines": ["headline1", "headline2", "headline3"],
  "alternativePrimaryTexts": ["text1", "text2"],
  "audienceInsight": "string - 2 sentence insight about why this audience will convert",
  "campaignStrategy": "string - 3 sentence strategy explanation"
}`;

    const response = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1200,
      temperature: 0.7,
    });

    const raw = response.choices[0].message.content || "{}";

    // Clean JSON
    const cleaned = raw
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    let adData;
    try {
      adData = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: "AI response parse error. Try again." }, { status: 500 });
    }

    return NextResponse.json({ success: true, ad: adData });

  } catch (error: any) {
    console.error("Meta ad generate error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
