import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export interface ModelAnswerRequest {
  curriculum: string;
  yearGroup: string;
  subject: string;
  question: string;
  contentRequirements?: string;
  guidelines?: string;
  totalMarks: number;
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const body: ModelAnswerRequest = await req.json();
  const { curriculum, yearGroup, subject, question, contentRequirements, guidelines, totalMarks } = body;

  if (!curriculum || !yearGroup || !subject?.trim() || !question?.trim() || typeof totalMarks !== "number") {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const contentBlock = contentRequirements?.trim()
    ? `\n\nContent requirements / exam spec guidance:\n${contentRequirements.trim()}`
    : "";

  const guidelinesBlock = guidelines?.trim()
    ? `\n\nAdditional guidelines:\n${guidelines.trim()}`
    : "";

  const userPrompt = `Generate a model answer resource for the following exam-style question:

- Curriculum: ${curriculum}
- Year Group: ${yearGroup}
- Subject: ${subject}
- Total marks: ${totalMarks}
- Exam question: ${question.trim()}${contentBlock}${guidelinesBlock}

Format the output exactly as follows (use markdown):

# Model Answer Resource

## Exam Question

${question.trim()} (${totalMarks} marks)

## Model Answer

[Write a full model answer appropriate for ${yearGroup} students studying ${subject} under the ${curriculum}. The answer should be worth ${totalMarks} marks. Write it in continuous prose paragraphs — no bullet points or numbered lists. The answer should be clearly structured with an introduction, developed body paragraphs, and a conclusion. Length and depth should reflect the mark allocation.]

## Teacher Notes

**Key Assessment Criteria:**

- [Criterion]
- [Criterion]
- [Criterion]
- [Criterion]

**Content Coverage:**

- [Content point covered in the model answer]
- [Content point]
- [Content point]
- [Content point]

**Skills Demonstrated:**

- [Skill]
- [Skill]
- [Skill]

**Age-Appropriate Features:**

- [Feature of the writing appropriate for ${yearGroup}]
- [Feature]
- [Feature]

**Main Body – Key Points:**

- [Annotation of a key strength in the body]
- [Key point]
- [Key point]

**Structure and Development:**

- [Comment on structure]
- [Comment on development of argument/ideas]

**Conclusion:**

- [Comment on conclusion quality]

## Teaching Opportunities

- [How to use this model answer in teaching]
- [Common pitfall or misconception to address]
- [Differentiation suggestion]
- [Extension or challenge idea]

Rules:
- The model answer must be written entirely in continuous prose — no bullet points, numbered lists, or headers within the answer itself.
- All content must be appropriate for ${yearGroup} students following the ${curriculum}.
- The model answer must be genuinely exam-worthy and accurately reflect the subject matter of ${subject}.
- Do not use any emojis.
- Do not add any text before the main title or after the last teaching opportunity.`;

  const encoder = new TextEncoder();
  const anthropicStream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system:
      "You are an expert teacher and examiner with deep knowledge of UK school curricula. You write high-quality model answers for exam-style questions and provide detailed teacher notes to support classroom use. Your model answers are accurate, well-structured, and pitched at the correct level for the year group. Your teacher notes are practical and actionable. Write clearly and professionally. Do not use any emojis anywhere in your output.",
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
