export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";

const schema = z.object({ category: z.string().default("Fantasy") });

export async function POST(req: NextRequest) {
  try {
    const { category } = schema.parse(await req.json().catch(() => ({})));

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        seed: `A fresh ${category.toLowerCase()} hook about an unusual discovery at dawn.`,
      });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const sys =
      "You craft a single, compelling one-sentence story hook (10-25 words), no quotes, no preamble. Output JSON: {seed}.";
    const user = `Category: ${category}`;

    const chat = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    });

    const content = chat.choices[0]?.message?.content ?? "{}";
    let json: any;
    try { json = JSON.parse(content); } catch { json = {}; }
    const seed = typeof json.seed === "string" && json.seed.trim()
      ? json.seed.trim()
      : "A mysterious knock arrives at an impossible hour.";
    return NextResponse.json({ seed });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to generate seed" }, { status: 500 });
  }
}

