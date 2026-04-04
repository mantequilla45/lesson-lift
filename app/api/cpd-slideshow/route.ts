import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export interface SlideData {
  type: "title" | "content";
  title: string;
  presentationTitle: string;
  subtitle?: string;
  body?: string;
  bullets?: string[];
  imageSuggestion?: string;
}

interface GenerateBody {
  action: "generate";
  topic: string;
  slideCount: number;
  additionalFocus: string;
  presentationFocus: "Practical application" | "Research and theory";
  contentFormat: "Text" | "Text and bullet point summary";
  includeImageSuggestions: boolean;
}

interface RefineBody {
  action: "refine";
  slides: SlideData[];
  instruction: string;
}

type RequestBody = GenerateBody | RefineBody;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildGeneratePrompt(body: GenerateBody): string {
  const imageLine = body.includeImageSuggestions
    ? `- Each content slide must include an "imageSuggestion" field with a short, specific image search query (e.g. "teachers collaborating in a staff room"). Omit on the title slide.`
    : `- Do not include any "imageSuggestion" field.`;

  const bulletLine =
    body.contentFormat === "Text and bullet point summary"
      ? `- Each content slide must include a "bullets" array with exactly 3 concise bullet points summarising key points from the body.`
      : `- Do not include any "bullets" field.`;

  const focusLine =
    body.presentationFocus === "Practical application"
      ? "Focus on practical classroom application — strategies, activities, and actionable steps teachers can implement immediately."
      : "Focus on research, theory, and evidence base — academic context, studies, and conceptual frameworks.";

  const additionalLine = body.additionalFocus?.trim()
    ? `Additional focus areas to incorporate: ${body.additionalFocus}`
    : "";

  return `Create a CPD (Continuing Professional Development) slideshow for teachers on: "${body.topic}".

${focusLine}
${additionalLine}

Output exactly ${body.slideCount} slides: 1 title slide followed by ${body.slideCount - 1} content slides.

IMPORTANT: Output each slide as a single JSON object on its own line. Do not wrap them in an array. Do not output anything else — no brackets, no separators, no explanation. One JSON object per line only.

Title slide format:
{"type":"title","title":"[compelling presentation title]","presentationTitle":"[same title]","subtitle":"[one-sentence session aim]"}

Content slide format:
{"type":"content","title":"[slide heading]","presentationTitle":"[same title as above]","body":"[3-4 sentence paragraph]","bullets":["...","...","..."],"imageSuggestion":"[search query]"}

Rules:
- "presentationTitle" must be identical on every slide.
- Content slides have a 3–4 sentence body paragraph.
${bulletLine}
${imageLine}
- Professional tone suitable for a teacher CPD session.
- No emojis. No text outside the JSON objects.`;
}

function buildRefinePrompt(body: RefineBody): string {
  return `Modify the following CPD slideshow based on this instruction: "${body.instruction}"

Current slides:
${JSON.stringify(body.slides, null, 2)}

Return the modified slides in exactly the same JSON format:
{"slides": [/* updated slide objects */]}

Apply only the changes described. Keep everything else as-is.
No text outside the JSON object.`;
}

function parseSlides(text: string): SlideData[] {
  const stripped = text.replace(/^```(?:json)?\n?/m, "").replace(/\n?```\s*$/m, "").trim();
  const parsed = JSON.parse(stripped);
  if (!Array.isArray(parsed.slides)) throw new Error("Invalid response structure");
  return parsed.slides;
}

export async function POST(req: NextRequest) {
  const body: RequestBody = await req.json();

  if (!body.action) {
    return NextResponse.json({ error: "Missing action" }, { status: 400 });
  }

  // Generate: stream NDJSON — one slide JSON per line
  if (body.action === "generate") {
    if (!body.topic?.trim()) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const anthropicStream = client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system:
        "You are an expert CPD facilitator creating professional development slideshows for teachers. Output each slide as a single JSON object on its own line with no other text. No markdown, no code fences, no arrays, no separators. One valid JSON object per line only. Do not use emojis.",
      messages: [{ role: "user", content: buildGeneratePrompt(body) }],
    });

    const encoder = new TextEncoder();
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

  // Refine: standard JSON response
  if (body.action === "refine") {
    if (!body.instruction?.trim() || !body.slides?.length) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    try {
      const message = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system:
          "You are an expert CPD facilitator editing an existing slideshow. Return valid JSON exactly as requested — no additional text, markdown, or code fences. Do not use emojis.",
        messages: [{ role: "user", content: buildRefinePrompt(body) }],
      });

      const textBlock = message.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        return NextResponse.json({ error: "No response from AI" }, { status: 500 });
      }

      const slides = parseSlides(textBlock.text);
      return NextResponse.json({ slides });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to refine slideshow";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
