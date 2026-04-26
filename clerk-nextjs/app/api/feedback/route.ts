import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, rating, category, message } = body;

    if (!name || !email || !rating || !category || !message) {
      return NextResponse.json({ error: "All fields are required." }, { status: 400 });
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Rating must be between 1 and 5." }, { status: 400 });
    }

    const feedback = await prisma.Feedback.create({
      data: { name, email, rating: Number(rating), category, message },
    });

    return NextResponse.json({ success: true, id: feedback.id }, { status: 201 });
  } catch (err) {
    console.error("Feedback API error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}