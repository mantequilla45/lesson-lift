import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildPrompt(body: {
  curriculum: string;
  yearGroup: string;
  name: string;
  likes: string;
  happy: string;
  supportNeeds: string;
  supportStyle: string;
  hopes: string;
  interventionGroups: string;
  outsideAgency: string;
  includeAdditionalSupport: boolean;
}): string {
  const additionalSupportLine = body.includeAdditionalSupport
    ? `Under "How I Would Like to Be Supported", include two subsections:
  - **Essential Strategies (based on student input):** strategies drawn directly from the student's notes
  - **Additional Recommended Strategies (based on professional input):** evidence-based strategies a teacher or SENCO might add, and a "Curriculum Accommodations" bullet list relevant to the year group`
    : `Under "How I Would Like to Be Supported", write strategies drawn directly from the student's notes only.`;

  const interventionLine = body.interventionGroups.trim()
    ? `Intervention Groups: ${body.interventionGroups}`
    : "Intervention Groups: [Information about any intervention groups can be included here if applicable.]";

  const outsideLine = body.outsideAgency.trim()
    ? `Outside Agency Input: ${body.outsideAgency}`
    : "Outside Agency Input: [Information about any outside agency support can be included here if applicable.]";

  return `You are an expert SEND support specialist. Create a one-page student support profile for a student named ${body.name}.

The profile must be written entirely in the FIRST PERSON from the student's perspective (use "I", "me", "my").
The input notes below are written in the third person — rewrite them as the student's own voice.
Year group: ${body.yearGroup}
Curriculum: ${body.curriculum}

Input notes:
- What people like and admire about the student: ${body.likes}
- What makes the student happy: ${body.happy}
- What the student needs support with: ${body.supportNeeds}
- How the student likes to be supported: ${body.supportStyle}
- The student's hopes and wishes for the future: ${body.hopes}

Format using markdown:
# Student's Support Profile

**${body.yearGroup} • Review Date: [ENTER DATE] • Last Updated: [ENTER DATE]**

*This profile was created collaboratively with the student, their parents, and teaching staff.*

---

## What People Like and Admire About Me
[3–4 sentences in first person]

---

## What Makes Me Happy
[3–4 sentences in first person]

---

## What I Need Support With
[3–4 sentences in first person]

---

## How I Would Like to Be Supported
${additionalSupportLine}

---

## My Hopes and Wishes for the Future
[3–4 sentences in first person]

---

## Links to Additional Support
- **Intervention Groups:** ${interventionLine}
- **Outside Agency Input:** ${outsideLine}

Keep the language warm, student-centred, and age-appropriate for ${body.yearGroup}.
Do not include any preamble — begin directly with the profile title.`;
}

function buildRefinePrompt(result: string, instruction: string): string {
  return `You are an expert SEND support specialist. Modify the following one-page student support profile based on this instruction: "${instruction}"

Current profile:
${result}

Return the full updated profile in the same markdown format. Apply only the changes described. Keep everything else as-is. No preamble.`;
}

async function streamText(system: string, userContent: string) {
  const stream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: userContent }],
  });

  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
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
      cancel() { stream.abort(); },
    }),
    { headers: { "Content-Type": "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff" } },
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body.action === "refine") {
    if (!body.result?.trim() || !body.instruction?.trim()) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    return streamText(
      "You are an expert SEND support specialist. Return only the updated profile in markdown format with no preamble.",
      buildRefinePrompt(body.result, body.instruction),
    );
  }

  if (!body.name?.trim() || !body.yearGroup?.trim() || !body.curriculum?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  return streamText(
    "You are an expert SEND support specialist creating student-centred one-page profiles. Output only the profile in markdown format. No preamble, no explanation, no code fences.",
    buildPrompt(body),
  );
}
