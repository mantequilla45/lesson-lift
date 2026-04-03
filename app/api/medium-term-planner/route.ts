import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export interface MediumTermPlannerRequest {
  curriculum: string;
  yearGroup: string;
  subject: string;
  topic: string;
  numberOfLessons: number;
  examSpec?: string | null;
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const body: MediumTermPlannerRequest = await req.json();

  const { curriculum, yearGroup, subject, topic, numberOfLessons, examSpec } = body;

  if (!curriculum || !yearGroup || !subject?.trim() || !topic?.trim() || !numberOfLessons) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const examSpecSection = examSpec
    ? `\nIncorporate the following exam specification or curriculum guidance: ${examSpec}`
    : "";

  const userPrompt = `Create a medium term plan for the following:

- Curriculum: ${curriculum}
- Year Group: ${yearGroup}
- Subject: ${subject}
- Topic: ${topic}
- Number of Lessons: ${numberOfLessons}${examSpecSection}

Generate the plan as a markdown table with exactly these four columns:

| Lesson | Learning Objective | Summary of Lesson | Key Knowledge Children Will Learn by End of Lesson |

Rules:
- Include exactly ${numberOfLessons} lesson rows.
- The Lesson column should contain a short title in the format "Lesson 1: [Title]" where the title is a 2–5 word name for that lesson (e.g. "Lesson 1: Introduction to DNA").
- Each learning objective should be specific and measurable, starting with an action verb (e.g. "Students will be able to...").
- The lesson summary should describe what will be taught and the main activity (2–3 sentences).
- Key knowledge should be 2–4 bullet points separated by semicolons (since this is inside a table cell), listing the specific facts, concepts, or skills students will have acquired.
- Lessons should build progressively on one another across the sequence.
- Do not add any text before or after the table.
- Do not use any emojis.

Write in a professional, teacher-friendly tone.`;

  const encoder = new TextEncoder();
  const anthropicStream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system:
      "You are an expert teacher and curriculum designer specialising in medium term planning. You create detailed, structured, and pedagogically sound medium term plans. Write clearly and professionally. Do not use any emojis anywhere in your output.",
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
