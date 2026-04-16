// /app/api/test-lead/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateLeadScore, getLeadPriority } from "@/lib/leadScoring";
import { enrichLeadWithAI } from "@/lib/ai";

// ✅ GET (browser testing ke liye - dummy data)
export async function GET() {
  const lead = {
    email: "ceo@company.com",
    phone: "123456",
    company: "Tech Ltd",
    companySize: 100,

  };

  const score = calculateLeadScore(lead);
  const priority = getLeadPriority(score);

  return NextResponse.json({ score, priority });
}
export async function POST(req: Request) {
  try {
    const lead = await req.json();

    const score = calculateLeadScore(lead);
    const priority = getLeadPriority(score);

    const savedLead = await prisma.lead.create({
      data: {
        ...lead,
        score,
        priority,
      },
    });

    const aiResult = await enrichLeadWithAI(savedLead);

    let parsed;

    if (!aiResult) {
      console.error("AI returned null");
      return NextResponse.json(savedLead);
    }

    try {
      parsed = JSON.parse(aiResult);
    } catch (err) {
      console.error("AI JSON parse error:", err);
      return NextResponse.json(savedLead);
    }

    await prisma.lead.update({
      where: { id: savedLead.id },
      data: {
        score: parsed.score ?? score,
        priority: parsed.priority ?? priority,
        summary: parsed.summary,
        tags: parsed.tags ? parsed.tags.join(", ") : "",
      },
    });

    return NextResponse.json({
      ...savedLead,
      ai: parsed,
    });

  } catch (error: any) {
    console.error("🔥 API ERROR:", error);

    return NextResponse.json(
      { error: error.message || "Server error" },
      { status: 500 }
    );
  }
}
