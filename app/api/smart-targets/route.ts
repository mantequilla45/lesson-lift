import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export interface SmartTargetsRequest {
  curriculum: string;
  yearGroup: string;
  targets: string;
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const body: SmartTargetsRequest = await req.json();

  const { curriculum, yearGroup, targets } = body;

  if (!curriculum || !yearGroup || !targets?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const userPrompt = `Generate a SMART targets table for the following:

- Curriculum: ${curriculum}
- Year Group: ${yearGroup}
- Targets: ${targets}

Output a markdown table with the heading "## SMART Targets" followed by a table with exactly these 6 columns:
| Target | Specific | Measurable | Achievable | Relevant | Time-bound |

Rules:
- Each row corresponds to one target from the input.
- "Target" — a short, plain-English version of the target (student-facing language).
- "Specific" — a clear "I will..." statement describing exactly what the student will do.
- "Measurable" — an "I can..." statement with a concrete, observable measure of success.
- "Achievable" — how the student will work toward it (resources, support, strategies).
- "Relevant" — why this target matters to the student's learning or development.
- "Time-bound" — a realistic deadline (e.g. "By the end of week 2", "Every day for 2 weeks").
- Write in age-appropriate language for ${yearGroup} students.
- Do not use emojis.
- Keep each cell concise — no more than 2 sentences.`;

  const encoder = new TextEncoder();
  const anthropicStream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system:
      "You are an expert SEND and inclusion teacher specialising in writing SMART targets for students. You write clear, student-friendly targets that are specific, measurable, achievable, relevant, and time-bound. Do not use any emojis anywhere in your output.",
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
