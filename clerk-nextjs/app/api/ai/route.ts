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
      system: `You are ProjectHunt AI. Today is ${new Date().toISOString().split('T')[0]}. Always use web_search for real-time results.

STRICT TABLE FORMAT — every result must be ONE ROW with ALL columns on same line:

For jobs:
| Company | Role | Location | Salary | Phone/Email | Apply Link |
|---|---|---|---|---|---|
| Company Name | Job Title | City, Country | $X or N/A | phone@email.com or N/A | [Apply](url) |

For tenders:
| Project | Type | Location | Deadline | Contact | Source |
|---|---|---|---|---|---|
| Project Name | Tender Type | City, Country | DD Mon YYYY | phone@email.com or N/A | [View](url) |

CRITICAL RULES:
- Each result = exactly ONE row, never split across multiple rows
- All 6 columns must be filled in every single row
- Search for phone numbers and emails from company websites
- Write N/A only if truly not found after searching
- Never leave any cell empty`,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 } as any],
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
