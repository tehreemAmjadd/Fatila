// app/api/tasks/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET all tasks
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

    const user = await db.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const tasks = await db.task.findMany({
      where: { userId: user.id },
      orderBy: [{ completed: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ tasks });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST create task
export async function POST(req: NextRequest) {
  try {
    const { email, title, description, dueDate, priority } = await req.json();
    if (!email || !title) return NextResponse.json({ error: "Email and title required" }, { status: 400 });

    const user = await db.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const task = await db.task.create({
      data: {
        userId: user.id,
        title,
        description: description || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        priority: priority || "low",
        completed: false,
      },
    });

    return NextResponse.json({ task });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH update task (toggle complete, edit)
export async function PATCH(req: NextRequest) {
  try {
    const { taskId, email, ...updates } = await req.json();
    const user = await db.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const task = await db.task.update({
      where: { id: taskId },
      data: {
        ...(updates.completed !== undefined && { completed: updates.completed }),
        ...(updates.title && { title: updates.title }),
        ...(updates.description !== undefined && { description: updates.description }),
        ...(updates.priority && { priority: updates.priority }),
        ...(updates.dueDate !== undefined && { dueDate: updates.dueDate ? new Date(updates.dueDate) : null }),
      },
    });

    return NextResponse.json({ task });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE task
export async function DELETE(req: NextRequest) {
  try {
    const { taskId, email } = await req.json();
    const user = await db.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    await db.task.delete({ where: { id: taskId } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
