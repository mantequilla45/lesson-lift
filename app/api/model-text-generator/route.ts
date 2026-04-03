import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export interface ModelTextGeneratorRequest {
  curriculum: string;
  yearGroup: string;
  write: string;
  features: string;
  lengthWords: number;
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const body: ModelTextGeneratorRequest = await req.json();

  const { curriculum, yearGroup, write, features, lengthWords } = body;

  if (!curriculum || !yearGroup || !write?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const featuresSection = features?.trim()
    ? `\nLanguage and grammatical features to include: ${features}`
    : "";

  const userPrompt = `Write a model text for the following:

- Curriculum: ${curriculum}
- Year Group: ${yearGroup}
- What to write: ${write}
- Approximate length: ${lengthWords} words${featuresSection}

Write the model text first, then add a section titled "## Key Features in This Text" that identifies and explains the key writing features used, with numbered points and bullet points for each feature showing:
- What the feature is
- An example from the text
- Why it is effective

The model text should be age-appropriate for ${yearGroup} students, written in a clear and engaging style. Do not use any emojis. Write in a professional, teacher-friendly tone.`;

  const encoder = new TextEncoder();
  const anthropicStream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system:
      "You are an expert literacy teacher and writer specialising in creating high-quality model texts for use in the classroom. You write engaging, age-appropriate texts that clearly demonstrate specific writing features. Do not use any emojis anywhere in your output.",
    messages: [{ role: "user", content: userPrompt }],
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
