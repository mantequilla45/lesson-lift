import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export interface SensoryActivitiesRequest {
  curriculum: string;
  yearGroup: string;
  subject: string;
  topic: string;
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const body: SensoryActivitiesRequest = await req.json();

  const { curriculum, yearGroup, subject, topic } = body;

  if (!curriculum || !yearGroup || !subject?.trim() || !topic?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const userPrompt = `Generate 5 sensory activities for the following:

- Curriculum: ${curriculum}
- Year Group: ${yearGroup}
- Subject: ${subject}
- Topic: ${topic}

Format the output exactly as follows:

# Sensory Activities for ${topic}

Then for each of the 5 activities use this exact structure:

## [Number]. [Activity Title]

**Learning Objectives:** [One sentence]

**Core Concepts:** [Comma-separated concepts]

**Senses Targeted:**

- **[Sense]:** [How this sense is engaged]
- **[Sense]:** [How this sense is engaged]
- **[Sense]:** [How this sense is engaged]

**Activity Description:**

[2–4 sentence description of the activity]

**Resources Required:**

- [Resource]
- [Resource]
- [Resource]

**Sensory Adaptations:**

- **For sensory-sensitive students:** [Adaptation]
- **For sensory-seeking students:** [Adaptation]

**Cross-Curricular Connections:** [Subject (reason), Subject (reason)]

---

Rules:
- Each activity must clearly relate to the topic "${topic}" and be appropriate for ${yearGroup} students.
- Vary the senses targeted across the 5 activities.
- Do not use any emojis.
- Do not add any text before the title or after the last activity.`;

  const encoder = new TextEncoder();
  const anthropicStream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system:
      "You are an expert teacher specialising in multisensory learning. You create engaging, curriculum-aligned sensory activities that support diverse learners. Write clearly and professionally. Do not use any emojis anywhere in your output.",
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
