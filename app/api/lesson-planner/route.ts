import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export interface LessonPlanRequest {
  curriculum: string;
  yearGroup: string;
  subject: string;
  topic: string;
  learningObjective: string;
  pedagogicalTheory?: string | null;
  examSpec?: string | null;
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const body: LessonPlanRequest = await req.json();

  const { curriculum, yearGroup, subject, topic, learningObjective, pedagogicalTheory, examSpec } = body;

  if (!curriculum || !yearGroup || !subject?.trim() || !topic?.trim() || !learningObjective?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const pedagogySection = pedagogicalTheory
    ? `\nIntegrate the following pedagogical theory throughout the lesson plan: ${pedagogicalTheory}.`
    : "";

  const examSpecSection = examSpec
    ? `\nIncorporate the following exam specification or curriculum guidance content: ${examSpec}`
    : "";

  const userPrompt = `Create a detailed lesson plan for the following:

- Curriculum: ${curriculum}
- Year Group: ${yearGroup}
- Subject: ${subject}
- Topic: ${topic}
- Learning Objective: ${learningObjective}${pedagogySection}${examSpecSection}

Structure the lesson plan with exactly these sections using markdown headings:

## Section 1 – Clarity of Objective

Include:
- **Learning Objective**: A refined, specific version of the objective above
- **Success Criteria**: A numbered list of 3–4 measurable outcomes students will achieve
- **Knowledge Covered**: Bullet points of key knowledge students will learn
- **Skills Covered**: Bullet points of skills students will develop

---

## Section 2 – Evaluation of Prior Knowledge

Provide 5 questions a teacher can ask to assess students' prior knowledge before the lesson begins.

---

## Section 3 – Instructional Strategies

### Starter/Hook Activity

**Description**: A brief engaging activity (2–3 minutes) to hook students into the topic.
**Key Formative Assessment Questions**: 2 questions to check initial understanding.

### Main Teacher Input

**Summary of Key Concepts**: Bullet points of the core concepts to teach.
**Sequence of Teacher Input Teaching Steps**: A numbered list of 4–6 detailed teaching steps with bold titles.
**Checkpoints**: 3 questions to check students are following during teacher input.
**Potential Misconceptions**: Bullet points of common errors or misunderstandings to address.
**Link to Pedagogical Approach**: One sentence explaining how this section supports learning.

### Student Activities

Describe two activities:

**Activity 1: [Name] ([Type e.g. Guided Practice])**
**Description**: What students do, with specific examples.
**Teacher Guidance**: How the teacher supports during this activity.
**Link to Pedagogical Approach**: One sentence.

**Activity 2: [Name] ([Type e.g. Independent Practice])**
**Description**: What students do, with specific examples.
**Teacher Guidance**: How the teacher supports during this activity.
**Link to Pedagogical Approach**: One sentence.

### Plenary

**Description**: A closing activity to consolidate learning.
**Assessment Questions**: 2 questions to check end-of-lesson understanding.
**Success Criteria Check**: How the teacher verifies criteria have been met.
**Future Learning**: One sentence on what this lesson prepares students for.
**Link to Pedagogical Approach**: One sentence.

---

## Section 4 – Adaptation Strategies

**For More Confident Students**: 2 bullet points with extension ideas.
**For Less Confident Students**: 2 bullet points with scaffolding ideas.
**Considerations for Diverse Learning Needs**: 3 bullet points for accessibility and inclusion.

---

## Section 5 – Summative Assessment

**Assessment Opportunities**: 2 bullet points describing how learning will be assessed.
**Long-term Evaluation**: 1 bullet point on monitoring progress beyond this lesson.
**Self-Assessment**: 1 bullet point on how students self-evaluate their understanding.

---

## Section 6 – Resources and Technology

A bullet list of materials, tools, and technology needed for this lesson.

---

## Section 7 – Key Vocabulary

Provide a markdown table with two columns (Term | Definition) listing 4–6 key vocabulary items for this lesson.

Do not use any emojis. Write in a professional, teacher-friendly tone.`;

  const encoder = new TextEncoder();
  const anthropicStream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system:
      "You are an expert teacher and curriculum designer specialising in lesson planning. You create detailed, structured, and pedagogically sound lesson plans. Write clearly and professionally. Do not use any emojis anywhere in your output.",
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
