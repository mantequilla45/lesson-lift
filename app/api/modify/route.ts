import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

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
    system:
      "You are editing an existing educational document. Apply only the changes described in the instruction — keep everything else exactly as it is, preserving the same structure, formatting, headings, and markdown. Return the complete document with the changes applied. Do not add commentary or explanations. Do not use emojis. Never use the © symbol — always write labels as plain text: (a), (b), (c), (d).",
    messages: [
      {
        role: "user",
        content: `Here is the current document:\n\n${currentContent}\n\n---\n\nInstruction: ${instruction}`,
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
