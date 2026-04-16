// app/api/emails/verify/route.ts
// Tests Gmail SMTP connection without sending any email
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { smtpEmail, smtpPassword } = await req.json();

    if (!smtpEmail || !smtpPassword) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    // Clean password — remove spaces
    const cleanPassword = smtpPassword.replace(/\s/g, "");

    if (cleanPassword.length !== 16) {
      return NextResponse.json({
        error: `App Password must be exactly 16 characters. You provided ${cleanPassword.length}. Get one from: myaccount.google.com/apppasswords`,
      }, { status: 400 });
    }

    const nodemailer = await import("nodemailer");

    const transporter = nodemailer.createTransport({
      host:   "smtp.gmail.com",
      port:   587,
      secure: false,
      auth: {
        user: smtpEmail,
        pass: cleanPassword,
      },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 10000,
      greetingTimeout:   10000,
    });

    // Just verify the connection — does NOT send any email
    await transporter.verify();

    return NextResponse.json({
      success: true,
      message: `✅ Gmail connected successfully for ${smtpEmail}`,
    });

  } catch (error: any) {
    console.error("SMTP verify error:", error);
    const msg = error?.message || "";

    if (msg.includes("535") || msg.includes("Invalid login") || msg.includes("Username and Password")) {
      return NextResponse.json({
        error: "❌ Wrong App Password. Steps to fix:\n1. Go to myaccount.google.com/security\n2. Make sure 2-Step Verification is ON\n3. Go to myaccount.google.com/apppasswords\n4. Generate a NEW App Password for 'Mail'\n5. Copy all 16 characters and paste here",
      }, { status: 401 });
    }

    if (msg.includes("ECONNREFUSED") || msg.includes("ETIMEDOUT")) {
      return NextResponse.json({
        error: "❌ Cannot reach Gmail servers. Check your internet connection.",
      }, { status: 500 });
    }

    if (msg.includes("534") || msg.includes("less secure")) {
      return NextResponse.json({
        error: "❌ Gmail blocked this login. You MUST use an App Password (not your Gmail password). Enable 2-Step Verification first.",
      }, { status: 401 });
    }

    return NextResponse.json({ error: `❌ ${msg}` }, { status: 500 });
  }
}
