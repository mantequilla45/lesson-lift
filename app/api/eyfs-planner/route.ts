import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export interface EYFSPlannerRequest {
  curriculum: string;
  topic: string;
  numberOfWeeks: number;
  includeBookList: boolean;
  includeHomeLearning: boolean;
  includeWeeklyOverview: boolean;
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const body: EYFSPlannerRequest = await req.json();

  const { curriculum, topic, numberOfWeeks, includeBookList, includeHomeLearning, includeWeeklyOverview } = body;

  if (!curriculum || !topic?.trim() || !numberOfWeeks) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const additionalSections: string[] = [];
  if (includeBookList) additionalSections.push("Book List");
  if (includeHomeLearning) additionalSections.push("Home Learning Ideas");
  if (includeWeeklyOverview) additionalSections.push("Weekly Overview");

  const additionalSection = additionalSections.length > 0
    ? `\n\nAfter all learning areas, also include the following additional sections: ${additionalSections.join(", ")}.`
    : "";

  const userPrompt = `Create an Early Years Foundation Stage (EYFS) plan for the following:

- Curriculum: ${curriculum}
- Topic: ${topic}
- Number of Weeks: ${numberOfWeeks}

Structure the output as follows:

# Early Years Plan for ${topic}

## Learning Areas in ${curriculum}

Begin with a short paragraph listing which EYFS learning areas this plan addresses.

Then for each of the 7 EYFS learning areas below, create a full section:

1. Communication and Language
2. Physical Development
3. Personal, Social and Emotional Development
4. Literacy
5. Mathematics
6. Understanding the World
7. Expressive Arts and Design

For each learning area, use this exact structure:

## [Learning Area Name]

### Child-Led Learning and Continuous Provision

**Indoor:**

- **[Activity Name]:** [Brief description of the activity and how it relates to the topic.]
  - **Resources:** [List of materials needed]
  - **Key Vocabulary:** [4–6 relevant words]
  - **Differentiation:** [How to adapt for different abilities]
  - **Learning Goal:** "[Relevant ELG statement]" (ELG: [ELG Name])

(Provide 2 indoor activities)

**Outdoor:**

- **[Activity Name]:** [Brief description]
  - **Resources:** [List]
  - **Key Vocabulary:** [4–6 words]
  - **Differentiation:** [Adaptation]
  - **Learning Goal:** "[ELG statement]" (ELG: [ELG Name])

(Provide 2 outdoor activities)

### Adult-Led Activities

- **[Activity Name]:** [Brief description of the adult-led activity]
  - **Resources:** [List]
  - **Key Vocabulary:** [4–6 words]
  - **Differentiation:** [Adaptation]
  - **Learning Goal:** "[ELG statement]" (ELG: [ELG Name])

(Provide 2 adult-led activities per learning area)

All activities must be clearly linked to the topic "${topic}" and appropriate for Early Years children. Scale the depth and range of activities to cover approximately ${numberOfWeeks} week(s) of teaching.${additionalSection}

Do not use any emojis. Write in a professional, teacher-friendly tone.`;

  const encoder = new TextEncoder();
  const anthropicStream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system:
      "You are an expert Early Years teacher and curriculum designer specialising in EYFS planning. You create detailed, structured, and developmentally appropriate plans that cover all seven areas of learning. Always reference the correct Early Learning Goals (ELGs). Write clearly and professionally. Do not use any emojis anywhere in your output.",
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
