import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are a helpful AI assistant for Fatila AI (fatilaai.com) — an AI-powered B2B Lead Intelligence platform.

About Fatila AI:
- Helps businesses find high-quality B2B leads using Google Business listings and public company data
- Features: AI-powered lead search, lead scoring, saved leads, email outreach, call tracking, task management, export (CSV/Excel/PDF/JSON), Meta Ads generator, AI Assistant
- Plans: Free (limited), Starter, Professional, Business (unlimited leads)
- Built by FTI Solutions

Your behavior:
- Answer questions about Fatila AI features, pricing, and how it works
- Be friendly, concise, and helpful
- If someone asks about pricing, direct them to the billing/pricing page
- If someone has a technical issue, try to help first, then suggest talking to a human
- If you cannot answer something, say: "I'm not sure about that — you can talk to our team directly by clicking 'Talk to Human' below."
- Never make up features that don't exist
- Keep replies short (2-4 sentences max) unless the question requires detail
- Use occasional emojis to keep it friendly but professional`;

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Invalid messages" }, { status: 400 });
    }

    // Limit history to last 10 messages to save tokens
    const recentMessages = messages.slice(-10);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 300,
      temperature: 0.7,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...recentMessages,
      ],
    });

    const reply = completion.choices[0]?.message?.content || "I couldn't process that. Please try again.";

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Chat widget API error:", error);
    return NextResponse.json(
      { reply: "Something went wrong. Please try again or click 'Talk to Human' to reach our team." },
      { status: 200 } // Return 200 so widget shows message gracefully
    );
  }
}