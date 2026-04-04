import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildSystem } from "@/app/lib/systemPrompt";

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

  const userPrompt = `Create a high-quality, classroom-ready worksheet for the following:

- Curriculum: ${curriculum}
- Year Group: ${yearGroup}
- Subject: ${subject}
- Learning Objective: ${learningObjective}${examSpecSection}

This worksheet is for use in a UK school. It should be rigorous, carefully sequenced, and pitched accurately for ${yearGroup} students. The questions must build progressively from knowledge recall through to higher-order thinking, in line with Bloom's Taxonomy.

Structure the worksheet using markdown as follows:

# [Worksheet Title — make this specific to the topic, not generic]

**Curriculum:** ${curriculum} | **Year Group:** ${yearGroup} | **Subject:** ${subject}

**Learning Objective:** [Restate the learning objective in clear, student-facing language beginning with "I am learning to..."]

**Name:** ______________________________ **Date:** ______________ **Class:** ______________

---

## Section A – Knowledge Recall [1 mark each]

Write 4–5 short-answer or fill-in-the-blank questions that test students' ability to recall key facts, definitions, or processes directly related to the learning objective. Questions should be unambiguous and have a single correct answer. Number each question. Blank lines for each answer should be shown as: ___________________________________

---

## Section B – Understanding [2 marks each]

Write 3–4 questions that require students to demonstrate understanding by explaining concepts in their own words, identifying relationships, or interpreting information. These should go beyond pure recall. Include the mark allocation in brackets after each question, e.g. [2 marks]. Leave adequate answer space (shown as multiple blank lines).

---

## Section C – Application [3–4 marks each]

Write 2–3 questions where students apply their knowledge to a new scenario, worked example, or unfamiliar context. Include a brief stimulus (e.g. a scenario, data extract, or diagram description) where appropriate. Include mark allocations.

---

## Section D – Analysis and Evaluation [6–8 marks]

Write 1–2 higher-order questions requiring extended written responses. Questions should ask students to analyse, evaluate, justify, or argue a position — not merely describe. Clearly state the mark allocation. Include a note of what a strong response will include (e.g. "Your answer should include: specific examples, a judgement, and use of subject vocabulary.").

---

## Answer Key

Provide a comprehensive answer key for all sections with:
- Section A: exact model answers
- Section B: mark scheme guidance noting what earns each mark
- Section C: full model answers with annotations
- Section D: a level descriptor or bullet-pointed mark scheme indicating what is required for full marks, partial marks, and no marks

Write in clear, professional language appropriate for ${yearGroup}. Do not use any emojis. Number all questions sequentially within each section. When labelling sub-questions use plain text letters in parentheses: (a), (b), (c), (d) — never use the © symbol.`;

  const encoder = new TextEncoder();
  const anthropicStream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: buildSystem("You are an expert UK teacher and curriculum designer with extensive experience creating high-quality classroom worksheets for KS1 through KS5. You understand Bloom's Taxonomy, tiered questioning, and how to scaffold access without reducing challenge. Your worksheets are precisely pitched for the specified year group, subject-accurate, and built around a clear learning objective. You write in professional UK English and produce materials that could be used in any well-run UK school without amendment. Never use the © symbol — always write sub-question labels as plain text: (a), (b), (c), (d)."),
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
