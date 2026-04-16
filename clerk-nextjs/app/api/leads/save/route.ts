// app/api/leads/save/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { email, lead } = await req.json();

    if (!email)         return NextResponse.json({ error: "Email required" },     { status: 400 });
    if (!lead?.company) return NextResponse.json({ error: "Lead data required" }, { status: 400 });

    // ── Find or auto-create user ─────────────────────────────────────────
    let user = await db.user.findUnique({ where: { email } });
    if (!user) {
      console.log("⚠️ User not found, auto-creating:", email);
      user = await db.user.create({
        data: { email, plan: "free", subscriptionStatus: "inactive", role: "user" },
      });
    }
    console.log("👤 User:", user.id, user.email);

    const leadModel = (db as any).lead;
    if (!leadModel) {
      return NextResponse.json({ error: "Run: npx prisma generate" }, { status: 500 });
    }

    // ── Check if lead already exists for THIS user ───────────────────────
    if (lead.placeId) {
      const existing = await leadModel.findFirst({
        where: { placeId: String(lead.placeId), userId: user.id },
      }).catch(() => null);

      if (existing) {
        // Already exists — just flip saved to true
        await leadModel.update({
          where: { id: existing.id },
          data:  { saved: true },
        });
        console.log("📌 Existing lead marked saved:", existing.id);
        return NextResponse.json({ success: true, id: existing.id, action: "updated" });
      }
    }

    // ── Create new lead with saved: true ────────────────────────────────
    // Only fields that exist in your prisma schema after phase2 migration
    const newLead = await leadModel.create({
      data: {
        userId:      user.id,           // ✅ links to user
        saved:       true,              // ✅ mark as saved immediately
        status:      "new",
        source:      "google_maps",
        score:       Number(lead.score)    || 0,
        priority:    String(lead.priority  || "Low"),
        company:     String(lead.company),
        name:        null,
        email:       lead.email          ? String(lead.email)       : null,
        phone:       lead.phone          ? String(lead.phone)       : null,
        website:     lead.website        ? String(lead.website)     : null,
        address:     lead.address        ? String(lead.address)     : null,
        industry:    lead.industry       ? String(lead.industry)    : null,
        aiInsights:  lead.aiInsight      ? String(lead.aiInsight)   : null,
        summary:     lead.aiInsight      ? String(lead.aiInsight)   : null,
        tags:        lead.industry       ? String(lead.industry)    : null,
        placeId:     lead.placeId        ? String(lead.placeId)     : null,
        linkedinUrl: lead.linkedinUrl    ? String(lead.linkedinUrl) : null,
      },
    });

    console.log("✅ Lead saved successfully:", newLead.id, newLead.company, "saved:", newLead.saved);

    return NextResponse.json({
      success: true,
      id:      newLead.id,
      action:  "created",
      company: newLead.company,
      saved:   newLead.saved,
    });

  } catch (error: any) {
    console.error("❌ Save lead error:", {
      message: error?.message,
      code:    error?.code,
      meta:    error?.meta,
    });

    if (error?.code === "P2002") {
      // Unique constraint — try to find and update instead
      try {
        const leadModel = (db as any).lead;
        const existing  = await leadModel.findFirst({
          where: { placeId: String((await (new Response(JSON.stringify({}))).json())?.lead?.placeId || "") }
        }).catch(() => null);
        if (existing) {
          await leadModel.update({ where: { id: existing.id }, data: { saved: true } });
          return NextResponse.json({ success: true, id: existing.id, note: "duplicate updated" });
        }
      } catch (_) {}
      return NextResponse.json({ success: true, note: "Already saved" });
    }

    if (error?.code === "P2003") {
      return NextResponse.json({ error: "User link error. Please re-login." }, { status: 400 });
    }

    // Unknown argument = field not in schema
    if (error?.message?.includes("Unknown argument")) {
      const match = error.message.match(/Unknown argument `(\w+)`/);
      const field = match ? match[1] : "unknown";
      return NextResponse.json({
        error: `Field '${field}' not in schema. Run: npx prisma generate`,
      }, { status: 500 });
    }

    return NextResponse.json({
      error: error?.message || "Save failed",
      code:  error?.code,
    }, { status: 500 });
  }
}