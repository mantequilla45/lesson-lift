import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildPrompt(
  curriculum: string,
  policy: string,
  additionalRequirements: string,
  outputType: "full" | "structure",
): string {
  const focusLine =
    outputType === "full"
      ? "Draft a complete, detailed school policy document with full written sections."
      : "Draft a policy section structure only — provide numbered headings and sub-headings with a one or two sentence description of what each section should cover, but do not write the full content.";

  const additionalLine = additionalRequirements.trim()
    ? `Additional requirements to incorporate: ${additionalRequirements}`
    : "";

  return `You are an expert school policy writer. Create a school policy document for: "${policy}".

Curriculum context: ${curriculum}
${focusLine}
${additionalLine}

Format the document using markdown:
- Use # for the main policy title
- Immediately after the title, include a document info block formatted as a markdown list (using - ) like this:
  - **School Name:** [Insert School Name]
  - **Policy Category:** [relevant category]
  - **Date Adopted:** [Insert Date]
  - **Review Date:** [Insert Review Date]
  - **Policy Owner:** [Insert Policy Owner]
  - **Approved By:** [Insert Approving Body]
- Follow the document info block with a --- separator
- Use ## for major section headings (e.g. ## 1.0 Introduction)
- Use ### for sub-section headings (e.g. ### 1.1 Purpose)
- Use bullet points (- ) for lists
- Use numbered lists (1. ) for procedural steps
- Use **bold** for key terms and important labels
- Use --- to separate major sections

The policy should be professional, clear, and appropriate for a UK school setting.
Do not add any preamble — begin directly with the policy title.`;
}

function buildRefinePrompt(result: string, instruction: string): string {
  return `You are an expert school policy writer. Modify the following school policy based on this instruction: "${instruction}"

Current policy:
${result}

Return the full updated policy in the same markdown format. Apply only the changes described. Keep everything else as-is. No preamble — begin directly with the policy content.`;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  if (action === "refine") {
    const { result, instruction } = body;
    if (!result?.trim() || !instruction?.trim()) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const stream = client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: "You are an expert school policy writer. Return only the updated policy in markdown format with no preamble or explanation.",
      messages: [{ role: "user", content: buildRefinePrompt(result, instruction) }],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
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
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff" },
    });
  }

  // Default: generate
  const { curriculum, policy, additionalRequirements = "", outputType = "full" } = body;
  if (!curriculum?.trim() || !policy?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const stream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: "You are an expert school policy writer. Output only the policy document in markdown format. No preamble, no explanation, no code fences.",
    messages: [{ role: "user", content: buildPrompt(curriculum, policy, additionalRequirements, outputType) }],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
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
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff" },
  });
}
