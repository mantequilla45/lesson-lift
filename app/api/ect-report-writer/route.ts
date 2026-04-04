import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export interface ECTReportWriterRequest {
  curriculum: string;
  ectName: string;
  subject?: string;
  strengths: string;
  areasForDevelopment: string;
  includeProfessionalDevelopmentPlan: boolean;
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const body: ECTReportWriterRequest = await req.json();

  const { curriculum, ectName, subject, strengths, areasForDevelopment, includeProfessionalDevelopmentPlan } = body;

  if (!curriculum || !ectName?.trim() || !strengths?.trim() || !areasForDevelopment?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const subjectLine = subject?.trim() ? `\n- Subject: ${subject}` : "";

  const pdpSection = includeProfessionalDevelopmentPlan ? `

## Professional Development Plan

After the summary, include a structured Professional Development Plan with:

### Short-term Actions (Next 4–6 weeks)

2 numbered action points, each with:
- **Teacher Standard:** [TS reference and full name]
- **Implementation strategy:** [Specific, concrete steps the ECT should take]
- **Resources required:** [What is needed to complete this action]
- **Success indicators:** [How progress will be measured]

### Medium-term Actions (Next term)

2 numbered action points, each with:
- **Teacher Standard:** [TS reference]
- **Implementation strategy:** [Specific steps]
- **Potential mentors/collaborators:** [Who can support]
- **Expected classroom impact:** [What improvement in outcomes should be seen]

### Long-term Professional Goals (Next 6–12 months)

1–2 overarching goals, each with bullet points for:
- **Teacher Standards:** [Relevant TS references]
- **Professional development opportunities:** [CPD, training, networks]
- **School improvement alignment:** [How this links to school priorities]
- **Career progression impact:** [How this supports the ECT's development]

### Recommended Resources

A categorised list including Professional Literature (2 books), Digital Resources and Communities (2 links/platforms), Subject-Specific Support (2 items), and School-Based Support (2 items).` : "";

  const userPrompt = `Write an ECT (Early Career Teacher) assessment report for the following:

- Curriculum: ${curriculum}
- ECT Name: ${ectName}${subjectLine}
- Strengths: ${strengths}
- Areas for Development: ${areasForDevelopment}

Structure the report as follows:

# Assessment Report: ${ectName}

## Strengths

Write 3 substantial paragraphs of evidence for the ECT's strengths. Each paragraph should:
- Reference specific Teacher Standards (e.g. Teacher Standard 1, TS3) by number and full name
- Use professional, formal language appropriate for a performance review
- Include specific examples of what the ECT does in practice and the impact on pupils
- Be evidence-based, referencing lesson observations, pupil work, and data where appropriate

## Areas for Development

Write 3 substantial paragraphs identifying areas for development. Each paragraph should:
- Reference specific Teacher Standards
- Describe the current gap or area requiring improvement
- Include 2–3 concrete, specific action steps the ECT should take
- Explain the expected impact on pupil outcomes once addressed

## Summary

Write 3 paragraphs summarising:
1. The ECT's key strengths and their impact
2. The principal areas for development and the rationale
3. An overall professional judgement and forward-looking statement${pdpSection}

Use ${ectName}'s name throughout. Write in third person. Use formal, professional language appropriate for an official ECT assessment report. Reference Teacher Standards by number and full name. Do not use any emojis.`;

  const encoder = new TextEncoder();
  const anthropicStream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system:
      "You are an expert school leader and ECT mentor specialising in writing detailed, evidence-based ECT assessment reports. You write formal, professional reports that make clear links to the Teacher Standards. Do not use any emojis anywhere in your output.",
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
