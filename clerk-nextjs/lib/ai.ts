import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function enrichLeadWithAI(lead: any) {
  const prompt = `
Analyze this lead and return response ONLY in valid JSON:

{
  "score": number,
  "priority": "Low | Medium | High",
  "summary": "short summary",
  "tags": ["tag1", "tag2"]
}

Lead Data:
Name: ${lead.name}
Email: ${lead.email}
Company: ${lead.company}
Message: ${lead.message}
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  return response.choices[0].message.content;
}