// app/api/leads/saved/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// ── POST: Fetch saved leads ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const {
      email,
      page     = 1,
      limit    = 20,
      search   = "",
      priority = "",
    } = await req.json();

    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

    // ── Find or auto-create user ─────────────────────────────────────────
    let user = await db.user.findUnique({ where: { email } });
    if (!user) {
      user = await db.user.create({
        data: { email, plan: "free", subscriptionStatus: "inactive", role: "user" },
      });
    }

    const leadModel = (db as any).lead;
    if (!leadModel) {
      return NextResponse.json({ leads: [], total: 0, pages: 0, page: 1 });
    }

    // ── Build where clause ───────────────────────────────────────────────
    // ✅ IMPORTANT: userId + saved = true — only THIS user's saved leads
    const baseWhere: any = {
      userId: user.id,
      saved:  true,
    };

    // Add priority filter
    if (priority) baseWhere.priority = priority;

    // Add search filter using OR — must be nested correctly
    let where: any = { ...baseWhere };
    if (search && search.trim() !== "") {
      where = {
        AND: [
          baseWhere,
          {
            OR: [
              { company:  { contains: search, mode: "insensitive" } },
              { industry: { contains: search, mode: "insensitive" } },
              { address:  { contains: search, mode: "insensitive" } },
              { phone:    { contains: search, mode: "insensitive" } },
            ],
          },
        ],
      };
    }

    const skip = (Number(page) - 1) * Number(limit);

    console.log("📋 Fetching saved leads for:", email, "| userId:", user.id);

    const [leads, total] = await Promise.all([
      leadModel.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: Number(limit),
      }),
      leadModel.count({ where }),
    ]);

    console.log(`✅ Found ${total} saved leads, returning ${leads.length}`);

    // Parse emails — stored as JSON string in DB, return as array
    const parsedLeads = leads.map((lead: any) => {
      let emails: string[] = [];
      try {
        if (Array.isArray(lead.emails)) emails = lead.emails;
        else if (typeof lead.emails === "string" && lead.emails) emails = JSON.parse(lead.emails);
      } catch {}
      // Make sure primary email is always included
      if (lead.email && !emails.includes(lead.email)) emails = [lead.email, ...emails];
      return { ...lead, emails };
    });

    return NextResponse.json({
      leads: parsedLeads,
      total,
      pages: Math.ceil(total / Number(limit)),
      page:  Number(page),
    });

  } catch (error: any) {
    console.error("❌ Fetch saved leads error:", error.message, error.code);
    return NextResponse.json({
      error:  error.message,
      code:   error.code,
      leads:  [],
      total:  0,
      pages:  0,
      page:   1,
    }, { status: 500 });
  }
}

// ── DELETE: Unsave a lead ────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const { leadId, email } = await req.json();
    if (!leadId || !email) {
      return NextResponse.json({ error: "leadId and email required" }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    await (db as any).lead.update({
      where: { id: leadId },
      data:  { saved: false },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("❌ Delete saved lead error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}