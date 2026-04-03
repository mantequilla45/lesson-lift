import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export interface PhonicsSupportRequest {
  curriculum: string;
  age: number;
  grapheme: string;
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const body: PhonicsSupportRequest = await req.json();
  const { curriculum, age, grapheme } = body;

  if (!curriculum || !grapheme?.trim() || typeof age !== "number") {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const userPrompt = `Generate a comprehensive phonics support resource for the following:

- Curriculum: ${curriculum}
- Age of students: ${age}
- Target grapheme/phoneme: '${grapheme}'

Format the output exactly as follows (use markdown):

# Phonics Support: '${grapheme}'

## Word Bank: '${grapheme}' Words by Type

**CVC Words:**

- [word]
(list 6–8 words)

**CCVC Words:**

- [word]
(list 6–8 words)

**CVCC Words:**

- [word]
(list 6–8 words)

**CCVCC Words:**

- [word]
(list 4–6 words)

**Two-Syllable Words:**

- [word]
(list 6–8 words)

**Multisyllabic Words:**

- [word]
(list 4–6 words)

**Words with '${grapheme}' as a Single Sound:**

- [word]
(list 6–8 words)

**Words with '${grapheme}' as Part of a Digraph:**

- [description or list]

**Words with '${grapheme}' as Part of a Trigraph:**

- [description or list, or "No applicable words for this category." if none]

## High-Frequency Words with '${grapheme}'

**Decodable High-Frequency Words:**

- [word]
(list 5–7 words)

**Tricky High-Frequency Words:**

- [word]
(list 2–4 words)

**Recommended Teaching Order:**

1. [word]
(ordered list of 6–8 words, mark sight words with "(as a sight word)")

## Decodable Text

**[Story Title]**
[A short decodable story of 4–6 sentences using '${grapheme}' words, appropriate for age ${age}. The story should use simple vocabulary and naturally incorporate many '${grapheme}' words.]

## Pseudo-Words Practice

- [pseudo-word]
(list 8–10 pronounceable non-words using the '${grapheme}' grapheme for phonics testing)

## Teaching Activities and Resources

### Activity 1: [Activity Title]

**Focus:** [What skill is being practised]

**Materials:** [Comma-separated list of materials]

**Curriculum Link:** [Relevant curriculum objective]

**Procedure:**

1. [Step]
2. [Step]
3. [Step]
4. [Step]

**Differentiation:**

- Support: [Adaptation for lower attainers]
- Challenge: [Adaptation for higher attainers]

### Activity 2: [Activity Title]

**Focus:** [What skill is being practised]

**Materials:** [Comma-separated list of materials]

**Curriculum Link:** [Relevant curriculum objective]

**Procedure:**

1. [Step]
2. [Step]
3. [Step]

**Differentiation:**

- Support: [Adaptation]
- Challenge: [Adaptation]

### Activity 3: [Activity Title]

**Focus:** [What skill is being practised]

**Materials:** [Comma-separated list of materials]

**Curriculum Link:** [Relevant curriculum objective]

**Procedure:**

1. [Step]
2. [Step]
3. [Step]

**Differentiation:**

- Support: [Adaptation]
- Challenge: [Adaptation]

### Activity 4: [Activity Title]

**Focus:** [What skill is being practised]

**Materials:** [Comma-separated list of materials]

**Curriculum Link:** [Relevant curriculum objective]

**Procedure:**

1. [Step]
2. [Step]
3. [Step]

**Differentiation:**

- Support: [Adaptation]
- Challenge: [Adaptation]

### Activity 5: [Activity Title]

**Focus:** [What skill is being practised]

**Materials:** [Comma-separated list of materials]

**Curriculum Link:** [Relevant curriculum objective]

**Procedure:**

1. [Step]
2. [Step]
3. [Step]

**Differentiation:**

- Support: [Adaptation]
- Challenge: [Adaptation]

## Common Misconceptions

- [Misconception]: [How to address it]
- [Misconception]: [How to address it]
- [Misconception]: [How to address it]

## Assessment Ideas

- [Assessment idea]
- [Assessment idea]
- [Assessment idea]

Rules:
- All content must be appropriate for ${age}-year-old students following the ${curriculum}.
- Do not use any emojis.
- Do not add any text before the main title or after the last assessment idea.
- Word lists must only include real English words (except pseudo-words section).
- Keep the decodable story short, engaging, and achievable for early readers.`;

  const encoder = new TextEncoder();
  const anthropicStream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system:
      "You are an expert phonics specialist and early reading teacher. You create detailed, curriculum-aligned phonics support resources for classroom teachers. Your word lists are carefully chosen for appropriate complexity, your decodable texts are engaging and achievable, and your activities are practical and differentiated. Write clearly and professionally. Do not use any emojis anywhere in your output.",
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
