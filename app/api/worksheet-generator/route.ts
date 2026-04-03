import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export interface WorksheetRequest {
  curriculum: string;
  yearGroup: string;
  subject: string;
  learningObjective: string;
  examSpec?: string | null;
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const body: WorksheetRequest = await req.json();

  const { curriculum, yearGroup, subject, learningObjective, examSpec } = body;

  if (!curriculum || !yearGroup || !subject?.trim() || !learningObjective?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const examSpecSection = examSpec
    ? `\nIncorporate the following exam specification or curriculum guidance content: ${examSpec}`
    : "";

  const userPrompt = `Create a classroom worksheet for the following:

- Curriculum: ${curriculum}
- Year Group: ${yearGroup}
- Subject: ${subject}
- Learning Objective: ${learningObjective}${examSpecSection}

Structure the worksheet using markdown as follows:

# [Worksheet Title]

**Curriculum:** ${curriculum} | **Year Group:** ${yearGroup} | **Subject:** ${subject}

**Learning Objective:** [Restate the learning objective clearly for students]

**Name:** ______________________________ **Date:** ______________ **Class:** ______________

---

## Section A – Knowledge Recall
[4–5 short-answer or fill-in-the-blank questions testing foundational knowledge. Each question on its own line, numbered.]

---

## Section B – Understanding
[3–4 questions requiring students to explain concepts in their own words or identify key ideas. Include point values in brackets, e.g. [2 marks].]

---

## Section C – Application
[2–3 questions where students apply knowledge to a scenario or worked example. Include point values.]

---

## Section D – Analysis & Evaluation
[1–2 higher-order questions requiring extended written responses. Clearly state the mark allocation, e.g. [6 marks].]

---

## Answer Key

Provide a clearly labelled answer key for all sections with model answers or marking guidance.

Write in a clear, professional tone appropriate for the year group. Do not use any emojis. Number all questions sequentially within each section. When labelling sub-questions use plain text letters in parentheses: (a), (b), (c), (d) — never use the © symbol.`;

  const encoder = new TextEncoder();
  const anthropicStream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system:
      "You are an expert teacher and curriculum designer specialising in creating high-quality classroom worksheets. Write clearly and at an appropriate level for the year group specified. Do not use any emojis anywhere in your output. Never use the © symbol — always write sub-question labels as plain text: (a), (b), (c), (d).",
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
