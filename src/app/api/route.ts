import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { question, knowledge } = await req.json();

  const systemPrompt = `You are a helpful assistant for a business. Use only the provided knowledge to answer. If you don't know, say "I don't know".\n\nKnowledge:\n${knowledge}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question },
      ],
    }),
  });

  const data = await res.json();
  const answer = data.choices?.[0]?.message?.content || "Sorry, something went wrong.";
  return NextResponse.json({ answer });
}
