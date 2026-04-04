import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { curriculum, objective } = body;

  if (!curriculum || !objective?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const prompt = `You are an experienced Early Years leader helping to write a detailed, professional EYFS Action Plan.

Curriculum: ${curriculum}
EYFS Objective: ${objective}

Generate a comprehensive EYFS Action Plan using the following structure. Use proper markdown formatting.

# EYFS Action Plan

## Objective
State the objective clearly and concisely.

## Success Criteria
List 3 numbered, measurable success criteria that will indicate the objective has been achieved.

## Implementation Plan

### Phase 1: Initial Actions (Weeks 1–4)

**Specific Actions:**
List 3–5 concrete actions to be taken in this phase.

**Responsibilities:**
State who is responsible (e.g. EYFS Lead, Key Workers, All Staff).

**Timeline:**
Weeks 1–4

**Expected Outcomes:**
Describe what should be in place or visible by the end of this phase.

**Monitoring Approach:**
Describe how progress will be monitored during this phase.

### Phase 2: Development (Weeks 5–8)

**Specific Actions:**
List 3–5 actions that build on Phase 1.

**Responsibilities:**
State who is responsible.

**Timeline:**
Weeks 5–8

**Expected Outcomes:**
Describe what should be in place or visible by the end of this phase.

**Monitoring Approach:**
Describe how progress will be monitored during this phase.

### Phase 3: Embedding Practice (Weeks 9–12)

**Specific Actions:**
List 3–5 actions focused on embedding and consolidating the changes.

**Responsibilities:**
State who is responsible.

**Timeline:**
Weeks 9–12

**Expected Outcomes:**
Describe what should be in place or visible by the end of this phase.

**Monitoring Approach:**
Describe how progress will be monitored during this phase.

### Phase 4: Evaluation and Review (Week 13+)

**Specific Actions:**
List 3–5 actions focused on evaluating impact and planning next steps.

**Responsibilities:**
State who is responsible.

**Timeline:**
Week 13 onwards

**Expected Outcomes:**
Describe what a successful evaluation will look like and what next steps may follow.

**Monitoring Approach:**
Describe how the overall impact will be reviewed and reported.

## Resources and Staffing Requirements

**Physical Resources:**
List any physical resources, materials, or classroom environments needed.

**Digital Resources:**
List any digital tools, platforms, or online resources required.

**Documentation and Assessment Resources:**
List any observation tools, tracking sheets, or assessment frameworks needed.

**Staffing Requirements:**
Describe any staffing considerations, roles, or time allocations needed.

**Training and CPD Requirements:**
List any staff training or professional development needed to support this plan.

**External Support:**
List any external agencies, advisors, or specialist support that may be needed.

**Budget Considerations:**
Provide brief guidance on any anticipated costs or budget considerations.

Write in a professional, action-oriented tone appropriate for a formal school improvement document. Be specific and practical — avoid vague generalities.`;

  const stream = await client.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 2000,
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
