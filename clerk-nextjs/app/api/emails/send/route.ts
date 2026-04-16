// app/api/emails/send/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const {
      email: userEmail,
      to, subject, body, companyName,
      smtpEmail, smtpPassword,
      smtpHost = "smtp.gmail.com",
      smtpPort = 587,
    } = await req.json();

    if (!to)      return NextResponse.json({ error: "Recipient email required" }, { status: 400 });
    if (!subject) return NextResponse.json({ error: "Subject required" }, { status: 400 });
    if (!body)    return NextResponse.json({ error: "Email body required" }, { status: 400 });

    const resolvedEmail    = smtpEmail    || process.env.SMTP_EMAIL;
    const resolvedPassword = smtpPassword || process.env.SMTP_PASSWORD;

    if (!resolvedEmail || !resolvedPassword) {
      return NextResponse.json({
        error: "Email not connected. Click 'Connect Email' and enter your Gmail + App Password.",
        needsSetup: true,
      }, { status: 400 });
    }

    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: smtpHost, port: Number(smtpPort),
      secure: Number(smtpPort) === 465,
      auth: { user: resolvedEmail, pass: resolvedPassword },
      tls: { rejectUnauthorized: false },
    });

    await transporter.verify();

    // ✅ Send from USER's own email — not LeadVision AI
    await transporter.sendMail({
      from:    `<${resolvedEmail}>`,
      to, subject,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">${body.replace(/\n/g,"<br/>")}</div>`,
      text: body,
      replyTo: resolvedEmail,
    });

    // ✅ Save to EmailLog DB
    if (userEmail) {
      try {
        const user = await db.user.findUnique({ where: { email: userEmail } });
        if (user) {
          await (db as any).emailLog.create({
            data: {
              userId:      user.id,
              to, subject, body,
              status:      "sent",
              companyName: companyName || null,
              fromEmail:   resolvedEmail,
              sentAt:      new Date(),
            },
          });
        }
      } catch (logErr: any) {
        console.warn("⚠️ Email log failed (run migration):", logErr.message);
      }
    }

    return NextResponse.json({ success: true, message: `✅ Email sent to ${to}` });

  } catch (error: any) {
    const msg = error?.message || "";
    console.error("❌ Send error:", msg);

    if (msg.includes("535") || msg.includes("Invalid login") || msg.includes("Username and Password")) {
      return NextResponse.json({
        error: "❌ Wrong App Password. Get a new one from: myaccount.google.com/apppasswords",
        needsSetup: true,
      }, { status: 401 });
    }
    if (msg.includes("ECONNREFUSED") || msg.includes("ETIMEDOUT")) {
      return NextResponse.json({ error: "❌ Cannot connect to Gmail. Check internet." }, { status: 500 });
    }
    return NextResponse.json({ error: `❌ ${msg}` }, { status: 500 });
  }
}
