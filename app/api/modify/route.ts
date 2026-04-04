import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildSystem } from "@/app/lib/systemPrompt";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { currentContent, instruction } = await req.json();

  if (!currentContent?.trim() || !instruction?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const anthropicStream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 8096,
    system: buildSystem("You are an expert UK educational document editor. Apply only the changes described in the instruction — keep everything else exactly as it is, preserving the same structure, formatting, headings, markdown, tone, and UK English spelling. Return the complete document with the changes applied. Do not add commentary, preambles, or explanations. Maintain professional UK school terminology throughout. Never use the © symbol — always write labels as plain text: (a), (b), (c), (d)."),
    messages: [
      {
        role: "user",
        content: `Here is the current educational document:\n\n${currentContent}\n\n---\n\nInstruction: ${instruction}\n\nApply the instruction precisely and consistently throughout the document. Where the instruction affects multiple sections, apply it to all relevant sections. Do not change anything not specified in the instruction. Maintain UK English spelling, professional tone, and the original document's structure and formatting throughout.`,
      },
    ],
  });

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of anthropicStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch (err) {
        controller.error(err);
      } finally {
        controller.close();
      }
    },
    cancel() {
      anthropicStream.abort();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
