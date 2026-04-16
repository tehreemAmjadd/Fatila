// app/api/dashboard/stats/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

    // ── Find or auto-create user ─────────────────────────────────────────
    let user = await db.user.findUnique({ where: { email } });
    if (!user) {
      user = await db.user.create({
        data: { email, plan: "free", subscriptionStatus: "inactive", role: "user" },
      });
    }

    const userId    = user.id;
    const leadModel = (db as any).lead;
    const taskModel = (db as any).task;

    // ── Run all queries in parallel ──────────────────────────────────────
    const [
      totalLeads,
      savedLeads,
      highPriorityLeads,
      completedTasks,
      pendingTasks,
      // ✅ Recent leads = ALL leads for user, most recent first (not just saved)
      recentLeadsRaw,
      leadsByPriorityRaw,
    ] = await Promise.all([

      leadModel
        ? leadModel.count({ where: { userId } }).catch(() => 0)
        : Promise.resolve(0),

      leadModel
        ? leadModel.count({ where: { userId, saved: true } }).catch(() => 0)
        : Promise.resolve(0),

      leadModel
        ? leadModel.count({ where: { userId, priority: "High" } }).catch(() => 0)
        : Promise.resolve(0),

      taskModel
        ? taskModel.count({ where: { userId, completed: true } }).catch(() => 0)
        : Promise.resolve(0),

      taskModel
        ? taskModel.count({ where: { userId, completed: false } }).catch(() => 0)
        : Promise.resolve(0),

      // ✅ ALL leads sorted by newest — shows what user just saved
      leadModel
        ? leadModel.findMany({
            where:   { userId },          // all leads for this user
            orderBy: { createdAt: "desc" }, // newest first
            take:    8,                   // show 8 on dashboard
            select: {
              id:        true,
              company:   true,
              industry:  true,
              score:     true,
              priority:  true,
              status:    true,
              phone:     true,
              website:   true,
              saved:     true,
              createdAt: true,
            },
          }).catch(() => [])
        : Promise.resolve([]),

      // Priority breakdown
      leadModel
        ? leadModel.groupBy({
            by:     ["priority"],
            where:  { userId },
            _count: { priority: true },
          }).catch(() => [])
        : Promise.resolve([]),
    ]);

    // ── Monthly leads (last 6 months) ────────────────────────────────────
    const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const monthlyMap: Record<string, number> = {};

    for (let i = 5; i >= 0; i--) {
      const d   = new Date();
      d.setMonth(d.getMonth() - i);
      monthlyMap[`${MONTHS[d.getMonth()]} ${d.getFullYear()}`] = 0;
    }

    if (leadModel) {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - 5);
      cutoff.setDate(1);
      cutoff.setHours(0, 0, 0, 0);

      const allLeads: any[] = await leadModel.findMany({
        where:  { userId, createdAt: { gte: cutoff } },
        select: { createdAt: true },
      }).catch(() => []);

      allLeads.forEach((l: any) => {
        const d   = new Date(l.createdAt);
        const key = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
        if (key in monthlyMap) monthlyMap[key]++;
      });
    }

    const monthlyLeads = Object.entries(monthlyMap).map(([k, count]) => ({
      month: k.split(" ")[0],
      count,
    }));

    console.log(`📊 Dashboard stats for ${email}: ${totalLeads} leads, ${savedLeads} saved, ${recentLeadsRaw.length} recent`);

    return NextResponse.json({
      totalLeads,
      savedLeads,
      highPriorityLeads,
      completedTasks,
      pendingTasks,
      recentLeads: recentLeadsRaw.map((l: any) => ({
        ...l,
        createdAt: new Date(l.createdAt).toISOString(),
      })),
      leadsByPriority: (leadsByPriorityRaw as any[]).map((p: any) => ({
        priority: p.priority,
        count:    p._count?.priority ?? 0,
      })),
      monthlyLeads,
    });

  } catch (error: any) {
    console.error("❌ Dashboard stats error:", error.message);
    // Return safe empty response — never crash dashboard
    return NextResponse.json({
      totalLeads:        0,
      savedLeads:        0,
      highPriorityLeads: 0,
      completedTasks:    0,
      pendingTasks:      0,
      recentLeads:       [],
      leadsByPriority:   [],
      monthlyLeads:      [],
    });
  }
}