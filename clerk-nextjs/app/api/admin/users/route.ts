// app/api/admin/users/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    // Verify the requester is admin
    const requester = await db.user.findUnique({ where: { email } });
    if (!requester) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (requester.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized — admin only" }, { status: 403 });
    }

    // Fetch all users with counts
    const users = await db.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id:                  true,
        email:               true,
        plan:                true,
        subscriptionStatus:  true,
        role:                true,
        createdAt:           true,
        _count: {
          select: {
            leads: true,
            tasks: true,
          },
        },
      },
    });

    return NextResponse.json({ users, total: users.length });

  } catch (error: any) {
    console.error("admin/users error:", error.message);
    return NextResponse.json(
      { error: error.message, users: [] },
      { status: 500 }
    );
  }
}