import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export interface QuizQuestion {
  question: string;
  options: [string, string, string, string];
  correctIndex: number; // 0–3
}

interface GenerateBody {
  action: "generate";
  curriculum: string;
  yearGroup: string;
  subject: string;
  topic: string;
  numQuestions: number;
  timeLimit: number;
  answerType: string;
}

interface AddBody {
  action: "add";
  curriculum: string;
  yearGroup: string;
  subject: string;
  topic: string;
  answerType: string;
  existingQuestions: QuizQuestion[];
}

interface RefineBody {
  action: "refine";
  existingQuestions: QuizQuestion[];
  instruction: string;
}

type RequestBody = GenerateBody | AddBody | RefineBody;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildGeneratePrompt(body: GenerateBody): string {
  return `Generate a multiple choice quiz with exactly ${body.numQuestions} questions about "${body.topic}" for ${body.yearGroup} students following the ${body.curriculum} in ${body.subject}.

Each question must have exactly 4 answer options and exactly 1 correct answer.

Return ONLY a raw JSON object — no markdown, no code fences, no explanation. The JSON must follow this exact structure:
{"questions":[{"question":"Question text here?","options":["Option A","Option B","Option C","Option D"],"correctIndex":2}]}

Rules:
- correctIndex is 0–3 (the index of the correct answer in the options array)
- Vary the position of the correct answer across questions — do not always place it in the same position
- Questions must be factually accurate and appropriate for ${body.yearGroup} students
- Test different aspects of the topic across questions
- No duplicate questions
- Do not include any text outside the JSON object`;
}

function buildAddPrompt(body: AddBody): string {
  const existing = body.existingQuestions
    .map((q, i) => `${i + 1}. ${q.question}`)
    .join("\n");
  return `You are adding one new question to an existing quiz about ${body.subject} for ${body.yearGroup} students.

Existing questions (do not duplicate or closely mirror these):
${existing}

Generate exactly 1 new multiple choice question that covers a different aspect of the topic.

Return ONLY a raw JSON object:
{"questions":[{"question":"...","options":["A","B","C","D"],"correctIndex":0}]}

Rules:
- correctIndex is 0–3
- 4 options exactly
- Factually accurate and appropriate for ${body.yearGroup}
- No text outside the JSON object`;
}

function buildRefinePrompt(body: RefineBody): string {
  return `Modify the following quiz questions based on this instruction: "${body.instruction}"

Current questions:
${JSON.stringify(body.existingQuestions, null, 2)}

Return the modified questions in the same JSON format. Return the same number of questions unless the instruction says to add or remove some.

Return ONLY a raw JSON object:
{"questions":[{"question":"...","options":["A","B","C","D"],"correctIndex":0},...]}

No text outside the JSON object.`;
}

function parseQuestions(text: string): QuizQuestion[] {
  // Strip markdown code fences if present
  const stripped = text.replace(/^```(?:json)?\n?/m, "").replace(/\n?```\s*$/m, "").trim();
  const parsed = JSON.parse(stripped);
  if (!Array.isArray(parsed.questions)) throw new Error("Invalid response structure");
  return parsed.questions.map((q: Partial<QuizQuestion>) => {
    if (
      typeof q.question !== "string" ||
      !Array.isArray(q.options) ||
      q.options.length !== 4 ||
      typeof q.correctIndex !== "number"
    ) {
      throw new Error("Malformed question in response");
    }
    return {
      question: q.question,
      options: q.options as [string, string, string, string],
      correctIndex: Math.max(0, Math.min(3, q.correctIndex)),
    };
  });
}

export async function POST(req: NextRequest) {
  const body: RequestBody = await req.json();

  if (!body.action) {
    return NextResponse.json({ error: "Missing action" }, { status: 400 });
  }

  let prompt: string;

  if (body.action === "generate") {
    if (!body.curriculum || !body.yearGroup || !body.subject?.trim() || !body.topic?.trim()) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    prompt = buildGeneratePrompt(body);
  } else if (body.action === "add") {
    if (!body.curriculum || !body.yearGroup || !body.subject?.trim()) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    prompt = buildAddPrompt(body);
  } else if (body.action === "refine") {
    if (!body.instruction?.trim() || !body.existingQuestions?.length) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    prompt = buildRefinePrompt(body);
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system:
        "You are an expert teacher creating multiple choice quizzes for school students. You always return valid JSON exactly as requested, with no additional text, markdown, or code fences. Your questions are accurate, age-appropriate, and test genuine curriculum knowledge.",
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "No response from AI" }, { status: 500 });
    }

    const questions = parseQuestions(textBlock.text);
    return NextResponse.json({ questions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate quiz";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
