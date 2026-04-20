// app/api/emails/send/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    let userEmail: string, to: string, subject: string, body: string;
    let companyName: string | null = null;
    let smtpEmail: string, smtpPassword: string;
    let smtpHost = "smtp.gmail.com";
    let smtpPort = 587;
    let attachments: { filename: string; content: Buffer; contentType: string }[] = [];

    // ── FormData (with attachments) ───────────────────────────────────────
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();

      userEmail    = formData.get("email")        as string || "";
      to           = formData.get("to")           as string || "";
      subject      = formData.get("subject")      as string || "";
      body         = formData.get("body")         as string || "";
      companyName  = formData.get("companyName")  as string || null;
      smtpEmail    = formData.get("smtpEmail")    as string || "";
      smtpPassword = formData.get("smtpPassword") as string || "";
      smtpHost     = formData.get("smtpHost")     as string || "smtp.gmail.com";
      smtpPort     = Number(formData.get("smtpPort") || 587);

      // Process attached files
      const files = formData.getAll("attachments") as File[];
      attachments = await Promise.all(
        files.map(async (file) => ({
          filename:    file.name,
          content:     Buffer.from(await file.arrayBuffer()),
          contentType: file.type || "application/octet-stream",
        }))
      );

    // ── JSON (bulk send — no attachments) ────────────────────────────────
    } else {
      const json = await req.json();
      userEmail    = json.email        || "";
      to           = json.to           || "";
      subject      = json.subject      || "";
      body         = json.body         || "";
      companyName  = json.companyName  || null;
      smtpEmail    = json.smtpEmail    || "";
      smtpPassword = json.smtpPassword || "";
      smtpHost     = json.smtpHost     || "smtp.gmail.com";
      smtpPort     = json.smtpPort     || 587;
    }

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

    // ✅ Send from USER's own email — with optional attachments
    await transporter.sendMail({
      from:    `<${resolvedEmail}>`,
      to, subject,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">${body.replace(/\n/g,"<br/>")}</div>`,
      text: body,
      replyTo: resolvedEmail,
      ...(attachments.length > 0 && { attachments }),
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