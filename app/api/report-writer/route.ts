import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export interface SubjectFocus {
  subject: string;
  strengths: string;
  areasForDevelopment: string;
  targets: string;
}

export interface ReportWriterRequest {
  name: string;
  gender: "Male" | "Female" | "Non-Binary";
  wordCount: number;
  includeTargets: boolean;
  tone: string;
  subjects: SubjectFocus[];
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function getPronouns(gender: ReportWriterRequest["gender"]) {
  if (gender === "Male") return { subject: "He", object: "him", possessive: "his" };
  if (gender === "Female") return { subject: "She", object: "her", possessive: "her" };
  return { subject: "They", object: "them", possessive: "their" };
}

export async function POST(req: NextRequest) {
  const body: ReportWriterRequest = await req.json();

  const { name, gender, wordCount, includeTargets, tone, subjects } = body;

  if (!name?.trim() || !gender || !subjects?.length) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const pronouns = getPronouns(gender);

  const subjectSections = subjects
    .filter((s) => s.subject?.trim())
    .map((s, i) => {
      const lines = [
        `Subject/Focus ${i + 1}: ${s.subject}`,
        `Strengths: ${s.strengths || "N/A"}`,
        `Areas for development: ${s.areasForDevelopment || "N/A"}`,
      ];
      if (includeTargets) lines.push(`Targets: ${s.targets || "N/A"}`);
      return lines.join("\n");
    })
    .join("\n\n");

  const targetInstruction = includeTargets
    ? "After the report paragraph for each subject, include a short 'Target' section with a specific, actionable target for the student."
    : "Do not include any targets.";

  const userPrompt = `Write a school report for the following student.

Student name: ${name}
Pronouns: ${pronouns.subject} / ${pronouns.object} / ${pronouns.possessive}
Approximate word count: ${wordCount} words total
Tone: ${tone || "formal"}

${subjectSections}

Instructions:
- Write a separate paragraph for each subject/focus area.
- Use the student's first name (${name}) naturally throughout.
- Use the correct pronouns: ${pronouns.subject} / ${pronouns.object} / ${pronouns.possessive}.
- ${targetInstruction}
- The overall report should be approximately ${wordCount} words.
- Use a ${tone || "formal"} tone throughout.
- Do not include any emojis.
- Do not include any personally identifiable information beyond the first name.
- Write in a professional, teacher-friendly style.
- Use "## [Subject name]" as the heading for each subject section.`;

  const encoder = new TextEncoder();
  const anthropicStream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system:
      "You are an expert teacher specialising in writing clear, professional, and personalised pupil school reports. You write in a positive, constructive tone that accurately reflects each student's strengths and areas for growth. Do not use any emojis anywhere in your output.",
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
