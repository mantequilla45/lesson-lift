import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildSystem } from "@/app/lib/systemPrompt";

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

  const prompt = `Write a comprehensive, expert-level Inspection Preparation Guide for senior leaders preparing for an upcoming ${inspectionBody} inspection or accreditation process${focusClause}.

This guide is for use in a UK school or education setting. It must reflect accurate, current knowledge of how ${inspectionBody} conducts inspections — including the specific judgement areas, evidence sources, and language used in inspection frameworks. For Ofsted inspections, this means aligning with the Education Inspection Framework (EIF) and associated handbooks. For other inspection or accreditation bodies, apply equivalent precision.

Generate the guide using the following structure. Use proper markdown formatting.

# Inspection Preparation Guide: ${inspectionBody}${inspectionFocus?.trim() ? ` — ${inspectionFocus}` : ""}

Write a concise 3–4 sentence introduction that: (1) states the purpose of this document, (2) identifies what ${inspectionBody} evaluates and the key judgement areas inspectors will consider${focusClause}, and (3) notes the most common areas where schools are found to have weaknesses in this type of inspection.

## Self-Evaluation Questions for Senior Leaders

For each of the following categories, provide 5 genuinely reflective self-evaluation questions. Questions must:
- Be specific to ${inspectionBody} inspection criteria${focusClause ? ` and the focus on ${inspectionFocus}` : ""}
- Challenge senior leaders to interrogate their own assumptions and gather evidence — not simply confirm what they already believe
- Mirror the kinds of questions inspectors themselves ask and the evidence they seek
- Be framed to expose gaps as well as strengths
- Progress from broad strategic questions to granular operational ones

### Leadership and Management
### Teaching and Learning
### Pupil Welfare and Safeguarding
### Academic Outcomes and Progress
### Community and Parental Engagement
### Resources, Environment, and Facilities
### Staff Professional Development and Wellbeing

## Preparation Actions for Senior Leaders

For each of the same categories, provide 5 specific, concrete, and immediately actionable preparation steps. Actions must:
- Be practical enough to assign to a named person and complete before the inspection
- Reference the specific evidence that will be gathered or generated
- Reflect what inspectors actually look for, not generic good practice advice
- Include any documentation, data, or conversations that should be prepared or had in advance

### Leadership and Management
### Teaching and Learning
### Pupil Welfare and Safeguarding
### Academic Outcomes and Progress
### Community and Parental Engagement
### Resources, Environment, and Facilities
### Staff Professional Development and Wellbeing
${evidenceNote}${successNote}${policyNote}

Write in a professional, authoritative tone appropriate for a senior leadership team. Questions must be genuinely thought-provoking — not surface-level checklist items. Actions must be specific and immediately actionable. Use UK English throughout.`;

  const stream = await client.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 3000,
    system: buildSystem("You are an expert UK school leader, former inspector, and inspection readiness consultant with extensive knowledge of Ofsted's Education Inspection Framework (EIF), SIAMS inspections, ISI inspections, and other UK educational accreditation processes. You have first-hand experience of what inspectors look for, what evidence they examine, and where schools most commonly have weaknesses. You write authoritative, specific, and immediately practical guidance for senior leadership teams preparing for inspections. You write in professional UK English and use accurate inspection terminology."),
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
