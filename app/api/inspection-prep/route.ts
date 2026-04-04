import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { inspectionBody, inspectionFocus, includeEvidence, includeSuccessCriteria, includePolicyChanges } = body;

  if (!inspectionBody?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const focusClause = inspectionFocus?.trim()
    ? ` with a specific focus on **${inspectionFocus.trim()}**`
    : "";

  const optionalSections: string[] = [];
  if (includeEvidence) optionalSections.push("Recommended Evidence");
  if (includeSuccessCriteria) optionalSections.push("Success Criteria");
  if (includePolicyChanges) optionalSections.push("Recent Policy Developments");

  const optionalNote = optionalSections.length > 0
    ? `\n\nAlso include the following sections at the end:\n${optionalSections.map((s) => `- ${s}`).join("\n")}`
    : "";

  const evidenceNote = includeEvidence
    ? `\n\n## Recommended Evidence\nList 6–8 types of evidence that senior leaders should gather before the inspection. For each, use the format: **Evidence Type**: Explanation of why this evidence is useful.`
    : "";

  const successNote = includeSuccessCriteria
    ? `\n\n## Success Criteria\nList 5–7 clear success criteria that would indicate the school is well-prepared for this inspection${focusClause}. For each, use the format: **Criterion**: Description.`
    : "";

  const policyNote = includePolicyChanges
    ? `\n\n## Recent Policy Developments\nList 5 recent or emerging policy developments relevant to ${inspectionBody} inspections${inspectionFocus?.trim() ? ` and ${inspectionFocus.trim()}` : ""}. For each, use the format: **Development**: Description of what has changed and why it matters.`
    : "";

  const prompt = `You are an experienced school leader and inspection specialist helping senior leaders prepare for an upcoming ${inspectionBody} inspection or accreditation process${focusClause}.

Generate a comprehensive Inspection Preparation Guide using the following structure. Use proper markdown formatting.

# Inspection Preparation Guide

Write a brief 2-sentence introduction explaining the purpose of this document and what the ${inspectionBody} inspection/accreditation process evaluates${focusClause}.

## Self-Evaluation Questions for Senior Leaders

For each of the following categories, provide 5 reflective self-evaluation questions that senior leaders should ask themselves before the inspection${focusClause ? ` (with a focus on ${inspectionFocus})` : ""}:

### Leadership and Management
### Teaching and Learning
### Student Welfare and Safeguarding
### Academic Outcomes
### Community and Parental Engagement
### Resources and Facilities
### Professional Development

## Preparation Actions for Senior Leaders

For each of the same categories above, provide 5 specific, practical actions that senior leaders should take to prepare for the ${inspectionBody} inspection${focusClause}:

### Leadership and Management
### Teaching and Learning
### Student Welfare and Safeguarding
### Academic Outcomes
### Community and Parental Engagement
### Resources and Facilities
### Professional Development
${evidenceNote}${successNote}${policyNote}

Write in a professional, practical tone. Questions should be genuinely reflective and thought-provoking. Actions should be concrete and actionable.${optionalNote ? "" : ""}`;

  const stream = await client.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 3000,
    messages: [{ role: "user", content: prompt }],
  });

  const encoder = new TextEncoder();
  const readableStream = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (
          chunk.type === "content_block_delta" &&
          chunk.delta.type === "text_delta"
        ) {
          controller.enqueue(encoder.encode(chunk.delta.text));
        }
      }
      controller.close();
    },
  });

  return new NextResponse(readableStream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
