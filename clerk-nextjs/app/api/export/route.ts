// app/api/export/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { email, format, filters = {} } = await req.json();

    if (!email || !format) {
      return NextResponse.json({ error: "Missing params" }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const leadModel = (db as any).lead;

    // ✅ Always export ONLY saved leads for this user
    const where: any = { saved: true };

    // Try adding userId filter
    try {
      where.userId = user.id;
    } catch (_) {}

    // Optional extra filters
    if (filters.priority) where.priority = filters.priority;
    if (filters.status)   where.status   = filters.status;

    const leads = await leadModel.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 5000,
    });

    console.log(`📤 Exporting ${leads.length} saved leads for ${email} as ${format}`);

    if (leads.length === 0) {
      // Return empty file with headers still
    }

    // ─── Helper to safely get any field ────────────────────────────────────
    const get = (lead: any, ...keys: string[]): string => {
      for (const key of keys) {
        const val = lead[key];
        if (val !== null && val !== undefined && String(val).trim() !== "") {
          return String(val).trim();
        }
      }
      return "";
    };

    // ─── Format date nicely ─────────────────────────────────────────────────
    const formatDate = (val: any): string => {
      if (!val) return "";
      try {
        return new Date(val).toLocaleDateString("en-GB", {
          day: "2-digit", month: "short", year: "numeric",
        });
      } catch {
        return String(val);
      }
    };

    // ─── Column definitions ─────────────────────────────────────────────────
    // Each entry: [Header Label, getValue(lead) => string]
    // NOTE: AI Summary removed — causes cell merging issues in spreadsheets
    const columns: [string, (lead: any) => string][] = [
      ["Company",    l => get(l, "company", "name")],
      ["Industry",   l => get(l, "industry", "tags")],
      ["Phone",      l => get(l, "phone")],
      ["Email",      l => get(l, "email")],
      ["Website",    l => get(l, "website")],
      ["Address",    l => get(l, "address")],
      ["Score",      l => get(l, "score")],
      ["Priority",   l => get(l, "priority")],
      ["Status",     l => get(l, "status")],
      ["Tags",       l => get(l, "tags", "industry")],
      ["LinkedIn",   l => get(l, "linkedinUrl")],
      ["Source",     l => get(l, "source")],
      ["Date Added", l => formatDate(l.createdAt)],
    ];

    const headers = columns.map(([h]) => h);
    const rows    = leads.map((lead: any) => columns.map(([, fn]) => fn(lead)));

    // ─── CSV ────────────────────────────────────────────────────────────────
    if (format === "csv") {
      const sanitizeCsv = (v: string) => v.replace(/[\r\n\t]+/g, " ").trim();
      const escape = (v: string) => `"${sanitizeCsv(v).replace(/"/g, '""')}"`;
      const lines = [
        headers.map(escape).join(","),
        ...rows.map((row: string[]) => row.map(escape).join(",")),
      ];
      return new NextResponse(lines.join("\r\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="saved-leads-${Date.now()}.csv"`,
        },
      });
    }

    // ─── Excel (CSV with BOM — opens correctly in Excel/WPS with proper columns) ──
    if (format === "excel") {
      const bom      = "\uFEFF";
      const sanitize = (v: string) => v.replace(/[\r\n\t]+/g, " ").trim();
const escape   = (v: string) => `"${sanitize(v).replace(/"/g, '""')}"`;
      const lines = [
        headers.map(escape).join(","),
        ...rows.map((row: string[]) => row.map(escape).join(",")),
      ];
      return new NextResponse(bom + lines.join("\r\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="saved-leads-${Date.now()}.csv"`,
        },
      });
    }

    // ─── JSON ───────────────────────────────────────────────────────────────
    if (format === "json") {
      const jsonData = leads.map((lead: any) => ({
        company:    get(lead, "company"),
        industry:   get(lead, "industry", "tags"),
        phone:      get(lead, "phone"),
        email:      get(lead, "email"),
        website:    get(lead, "website"),
        address:    get(lead, "address"),
        score:      Number(lead.score) || 0,
        priority:   get(lead, "priority"),
        status:     get(lead, "status"),
        tags:       get(lead, "tags", "industry"),
        linkedin:   get(lead, "linkedinUrl"),
        source:     get(lead, "source"),
        dateAdded:  formatDate(lead.createdAt),
      }));
      return new NextResponse(JSON.stringify(jsonData, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="saved-leads-${Date.now()}.json"`,
        },
      });
    }

    // ─── PDF (HTML print) ───────────────────────────────────────────────────
    if (format === "pdf") {
      const tableRows = leads.map((lead: any) => {
        const priority = get(lead, "priority");
        const pColor   = priority === "High" ? "#c00000" : priority === "Medium" ? "#c07000" : "#007000";
        const website  = get(lead, "website");
        const linkedin = get(lead, "linkedinUrl");
        const phone    = get(lead, "phone");

        return `
          <tr>
            <td><strong>${get(lead, "company")}</strong></td>
            <td>${get(lead, "industry", "tags")}</td>
            <td>${phone ? `<a href="tel:${phone}">${phone}</a>` : "—"}</td>
            <td>${get(lead, "email") || "—"}</td>
            <td>${website ? `<a href="${website}">${website.replace(/https?:\/\//, "").split("/")[0]}</a>` : "—"}</td>
            <td style="color:${pColor}; font-weight:bold">${priority}</td>
            <td style="text-align:center; font-weight:bold">${get(lead, "score")}</td>
            <td>${linkedin ? `<a href="${linkedin}">LinkedIn →</a>` : "—"}</td>
            <td>${formatDate(lead.createdAt)}</td>
          </tr>`;
      }).join("");

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>LeadVision AI — Saved Leads Export</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; padding: 20px; color: #111; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid #004d33; }
    .header h1 { font-size: 20px; color: #004d33; }
    .header p { color: #555; font-size: 12px; margin-top: 3px; }
    .meta { font-size: 11px; color: #666; text-align: right; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th { background: #004d33; color: white; padding: 8px 6px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px; white-space: nowrap; }
    td { padding: 7px 6px; border-bottom: 1px solid #eee; vertical-align: top; }
    tr:nth-child(even) td { background: #f7fdf9; }
    tr:hover td { background: #e8f9f0; }
    a { color: #004d33; text-decoration: none; }
    .footer { margin-top: 20px; font-size: 10px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 10px; }
    @media print {
      @page { margin: 10mm; size: A4 landscape; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>🎯 Fatila AI — Saved Leads</h1>
      <p>Exported by ${email} · ${leads.length} leads</p>
    </div>
    <div class="meta">
      ${new Date().toLocaleDateString("en-GB", { day:"2-digit", month:"long", year:"numeric" })}<br/>
      <span style="color:#004d33; font-weight:bold">FTI Solutions</span>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Company</th>
        <th>Industry</th>
        <th>Phone</th>
        <th>Email</th>
        <th>Website</th>
        <th>Priority</th>
        <th>Score</th>
        <th>LinkedIn</th>
        <th>Date</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows || `<tr><td colspan="9" style="text-align:center; padding:30px; color:#999">No saved leads found</td></tr>`}
    </tbody>
  </table>

  <div class="footer">
    Generated by LeadVision AI · Powered by FTI Solutions · ${new Date().toISOString()}
  </div>

  <script>
    window.onload = function() {
      setTimeout(() => window.print(), 500);
    };
  </script>
</body>
</html>`;

      return new NextResponse(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return NextResponse.json({ error: "Invalid format. Use: csv, excel, json, pdf" }, { status: 400 });

  } catch (error: any) {
    console.error("❌ Export error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}