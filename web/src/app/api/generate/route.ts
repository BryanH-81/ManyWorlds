export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";

const schema = z.object({
  category: z.string().default("Fantasy"),
  seed: z.string().min(1),
  direction: z.string().optional(), // <- NEW
  context: z.string().optional(),   // <- NEW (pass current node content here)
});

export async function POST(req: NextRequest) {
  try {
    const { category, seed, direction, context } = schema.parse(await req.json());

    // Fallback when no key: still return a node
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        title: `${category} — Stub Node`,
        content:
          `Stub node (no OPENAI_API_KEY).\n\nSeed: ${seed}\n` +
          (context ? `Context: ${context}\n` : "") +
          (direction ? `Direction: ${direction}\n` : "") +
          `Write a short scene and give choices.`,
        choices: ["Continue", "Go back", "Try something bold"],
      });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const sys =
      "You write immersive 400-600 word story nodes that end with 2-4 crisp choices. Respond as JSON: {title, content, choices: string[]}. Keep it PG-13.";
    const user =
      `Category: ${category}\n` +
      `Seed: ${seed}\n` +
      (context ? `Current Node:\n${context}\n` : "") +
      (direction ? `Player Direction:\n${direction}\n` : "");

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
    try { json = JSON.parse(content); }
    catch {
      json = { title: `${category} — Generated Node`, content, choices: ["Continue", "Rewind"] };
    }
    return NextResponse.json(json);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to generate" }, { status: 500 });
  }
}
