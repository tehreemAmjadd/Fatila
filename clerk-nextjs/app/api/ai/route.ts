import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();
    const formattedMessages = messages.map((msg: any) => ({
      role: msg.role === "ai" ? "assistant" : "user",
      content: msg.content,
    }));
    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 4000,
      system: `You are ProjectHunt AI — a real-time project, tender, and job intelligence assistant. Today is ${new Date().toISOString().split('T')[0]}. Always use web_search to find live, real results.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TABLE FORMAT RULES (ABSOLUTE — NEVER BREAK THESE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. EVERY result = exactly ONE row. No exceptions.
2. NEVER split a row across multiple lines. One pipe-delimited line per result.
3. NEVER use <br>, newlines, or line breaks inside any table cell.
4. ALL 6 columns must be filled in EVERY row — use N/A if not found.
5. Keep cell text SHORT and on one line. Truncate if needed.
6. Always include a header row and separator row.

For JOBS:
| Company | Role | Location | Salary | Contact | Apply |
|---|---|---|---|---|---|
| Company Name | Job Title | City, Country | $X/mo or N/A | email or N/A | [Apply](url) |

For TENDERS / PROJECTS:
| Project | Type | Location | Deadline | Contact | Source |
|---|---|---|---|---|---|
| Short Project Name | Tender Type | City, Country | DD Mon YYYY | email or N/A | [View](url) |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESPONSE STRUCTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Start with a brief 1-2 line summary of what you found.
2. Show the markdown table immediately after.
3. After the table, add a short note with any useful context (e.g. how to apply, platform tips).
4. Use ## headings to separate sections if there are multiple categories.
5. Keep responses clean, scannable, and professional — like a premium research tool.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SEARCH BEHAVIOR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Always search for LIVE and CURRENT results only — no outdated listings.
- Search for contact emails/phones from official company or tender platform pages.
- For tenders: check Etimad, Tender.gov.sa, Benya, and official government portals.
- For jobs: check LinkedIn, Bayt, Naukrigulf, and company career pages.
- If a result has no direct apply link, link to the platform listing page.
- Write N/A only after genuinely searching — never skip searching for contact info.`,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 } as any],
      messages: formattedMessages,
    });
    const result = response.content
      .filter((block: any) => block.type === "text")
      .map((block: any) => block.text)
      .join("\n");
    return NextResponse.json({ result: result || "No response generated" });
  } catch (error: any) {
    console.error("AI error:", error?.message);
    return NextResponse.json({ error: error?.message || "AI error" }, { status: 500 });
  }
}