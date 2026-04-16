// app/api/emails/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const {
      companyName,
      industry,
      website,
      tone,
      emailType,
      senderName,       // logged-in user's name
      senderEmail,      // logged-in user's email
      senderCompany,    // user's company (if provided)
      senderRole,       // user's role (if provided)
    } = await req.json();

    if (!companyName) {
      return NextResponse.json({ error: "Company name required" }, { status: 400 });
    }

    const toneMap: Record<string, string> = {
      professional: "professional and formal",
      friendly:     "warm, friendly and conversational",
      direct:       "direct, concise and to the point",
      persuasive:   "persuasive and compelling",
    };

    const typeMap: Record<string, string> = {
      cold_outreach: "initial cold outreach / introduction",
      follow_up:     "follow-up after no response",
      partnership:   "partnership or collaboration proposal",
      demo_request:  "requesting a product demo or discovery call",
      value_prop:    "sharing a value proposition and results",
    };

    // ✅ Sender is the REAL user, not LeadVision AI
    const actualSenderName    = senderName    || "Sales Representative";
    const actualSenderEmail   = senderEmail   || "";
    const actualSenderCompany = senderCompany || "our company";
    const actualSenderRole    = senderRole    || "Sales";

    const prompt = `You are a B2B sales email copywriter. Write a ${toneMap[tone] || "professional"} email for a ${typeMap[emailType] || "cold outreach"}.

IMPORTANT: This email is being sent by a REAL PERSON — not by any AI or software platform. Write it entirely from the perspective of the sender as a human professional.

SENDER INFORMATION:
- Name: ${actualSenderName}
- Email: ${actualSenderEmail}
- Company: ${actualSenderCompany}
- Role: ${actualSenderRole}

TARGET COMPANY:
- Company: ${companyName}
- Industry: ${industry || "their industry"}
- Website: ${website || "not provided"}

RULES:
1. Write ONLY the email — first line must be "Subject: [your subject]"
2. Leave a blank line then write the body
3. The email is FROM ${actualSenderName} at ${actualSenderCompany} — mention this naturally
4. Do NOT mention AI, LeadVision, software platforms, or any technology tools
5. Write as if ${actualSenderName} personally found ${companyName} and is reaching out
6. Keep it under 150 words — concise and human
7. End with a clear call to action
8. Sign off with: ${actualSenderName}${actualSenderRole ? `\n${actualSenderRole}` : ""}${actualSenderCompany !== "our company" ? `\n${actualSenderCompany}` : ""}${actualSenderEmail ? `\n${actualSenderEmail}` : ""}
9. Sound genuinely personal and human — no corporate buzzwords`;

    const response = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
      temperature: 0.85,
    });

    const fullText = response.choices[0].message.content || "";

    // Parse subject line and body
    const lines = fullText.split("\n");
    const subjectLine = lines.find(l => l.toLowerCase().startsWith("subject:"));
    const subject = subjectLine
      ? subjectLine.replace(/^subject:\s*/i, "").trim()
      : `Quick question for ${companyName}`;

    const bodyStart = subjectLine ? lines.indexOf(subjectLine) + 1 : 0;
    const body = lines.slice(bodyStart).join("\n").trim();

    return NextResponse.json({ subject, body, fullText });

  } catch (error: any) {
    console.error("AI email generation error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
