import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildSystem } from "@/app/lib/systemPrompt";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { challenges, educationPhase } = body;

  if (!challenges?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const prompt = `You are an expert school improvement adviser helping a UK school plan their Pupil Premium strategy. Generate evidence-based strategies for the challenges provided, using the DfE Pupil Premium guidance framework of Tier 1, Tier 2, and Tier 3 approaches.

INPUTS:
- Challenges: ${challenges}
- Education phase: ${educationPhase || "Not specified"}

Generate a Pupil Premium Strategy Plan using the structure below.

Output a title and subtitle, then a single markdown table. No preamble, no explanation after the table.

# Pupil Premium Strategy Plan

## Evidence-Based Approaches Aligned with DfE Best Practice

The table must have exactly these columns:

| Challenge | Tier 1: High-quality teaching | Tier 2: Targeted academic support | Tier 3: Wider strategies |

For each challenge provided, write one table row. Each tier cell must contain exactly these 5 fields on separate lines, each preceded by a bold label:

**Approach:** [A specific, named strategy appropriate to this tier and challenge — not generic]
**Evidence:** [A specific reference to EEF research, DfE guidance, or published evidence with approximate impact in months' progress where available]
**Implementation:** [Concrete steps to put this strategy in place — specific and actionable]
**Impact:** [Expected measurable impact on disadvantaged pupils if implemented well]
**Monitoring:** [How the school will track whether this strategy is working — specific data sources and review points]

Tier definitions to follow strictly:
- **Tier 1 (High-quality teaching):** Whole-class approaches that improve the quality of everyday teaching for all pupils, with particular benefit to disadvantaged pupils. Examples: explicit vocabulary instruction, responsive teaching, metacognition strategies, high-quality feedback.
- **Tier 2 (Targeted academic support):** Structured interventions for pupils who need additional academic support, delivered in small groups or one-to-one. Examples: small group tuition, one-to-one tutoring, structured literacy/numeracy programmes, National Tutoring Programme.
- **Tier 3 (Wider strategies):** Approaches that address non-academic barriers to learning for disadvantaged pupils. Examples: attendance support, social-emotional learning, mental health support, family engagement, extracurricular enrichment.

Each cell must be a single block of text — no nested bullet points, no line breaks within a field. Each of the 5 fields must appear on its own line within the cell.

Reference EEF (Education Endowment Foundation) research where relevant. Use UK English throughout. Be specific to the education phase: ${educationPhase || "the school phase"}.`;

  const stream = await client.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 4000,
    system: buildSystem("You are an expert UK school improvement adviser and Pupil Premium specialist with deep knowledge of the EEF Teaching and Learning Toolkit, DfE Pupil Premium guidance, and evidence-based approaches to closing the disadvantage gap. You help school leaders write rigorous, evidence-informed Pupil Premium strategy plans that meet DfE requirements and genuinely improve outcomes for disadvantaged pupils."),
    messages: [{ role: "user", content: prompt }],
  });

  const encoder = new TextEncoder();
  const readableStream = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
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
