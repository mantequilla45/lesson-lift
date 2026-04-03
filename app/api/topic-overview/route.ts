import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export interface TopicOverviewRequest {
  curriculum: string;
  yearGroup: string;
  subject: string;
  topic: string;
  numLessons: number;
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const body: TopicOverviewRequest = await req.json();
  const { curriculum, yearGroup, subject, topic, numLessons } = body;

  if (!curriculum || !yearGroup || !subject?.trim() || !topic?.trim() || !numLessons) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const userPrompt = `Create a topic overview for the following:

- Curriculum: ${curriculum}
- Year Group: ${yearGroup}
- Subject: ${subject}
- Topic: ${topic}
- Number of Lessons: ${numLessons}

Output the topic overview using this exact markdown structure:

# ${topic} — Topic Overview

**Curriculum:** ${curriculum} | **Year Group:** ${yearGroup} | **Subject:** ${subject}

---

## Lesson Breakdown

Produce a markdown table with exactly these columns (in this order):

| Lesson | Learning Objective | Starter | Input | Activity | Plenary | Resources | Questions | Key Vocabulary |

Rules for each column:
- **Lesson**: "Lesson 1: [Title]", "Lesson 2: [Title]", etc.
- **Learning Objective**: One clear sentence beginning with "Students will be able to…"
- **Starter**: A short engaging activity (1–2 sentences) to activate prior knowledge
- **Input**: The direct teaching content or explanation delivered to students (1–2 sentences)
- **Activity**: The main student task or tasks for the lesson (1–2 sentences)
- **Plenary**: A consolidation or reflection activity to close the lesson (1 sentence)
- **Resources**: Comma-separated list of 2–4 materials or tools needed
- **Questions**: 2–3 key questions to probe understanding, separated by " / "
- **Key Vocabulary**: 3–5 subject-specific terms, comma-separated

Generate exactly ${numLessons} rows — one per lesson.

---

## Assessment Opportunities

Briefly describe 2–3 ways to assess student understanding across the topic as a bullet list.

Write in a clear, professional tone suitable for ${yearGroup}. Do not use any emojis. When labelling items use plain text letters: (a), (b), (c) — never use the © symbol.`;

  const encoder = new TextEncoder();
  const anthropicStream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system:
      "You are an expert teacher and curriculum designer specialising in creating structured topic overviews. Your output must include a properly formatted markdown table with columns: Lesson, Learning Objective, Starter, Input, Activity, Plenary, Resources, Questions, Key Vocabulary. Write clearly and at an appropriate level for the year group specified. Do not use any emojis anywhere in your output. Never use the © symbol — always write labels as plain text: (a), (b), (c), (d).",
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
