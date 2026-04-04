import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildPrompt(body: {
  curriculum: string;
  yearGroup: string;
  activity: string;
  transport: string;
  location: string;
  resources: string;
}): string {
  const transportLine = body.transport.trim() ? `Mode of transport: ${body.transport}` : "";
  const locationLine = body.location.trim() ? `Location (if school based): ${body.location}` : "";
  const resourcesLine = body.resources.trim() ? `Resources/equipment involved: ${body.resources}` : "";

  return `You are an expert school health and safety officer. Create a comprehensive risk assessment for the following school activity.

Year group: ${body.yearGroup}
Curriculum: ${body.curriculum}
Activity or trip: ${body.activity}
${transportLine}
${locationLine}
${resourcesLine}

Generate a risk assessment table with at least 10–12 relevant hazards.

Format the output as a markdown table with exactly these columns:
| Hazard | Potential Harm | Who/what might be harmed? | Likelihood of occurrence | Severity of harm | Risk Level | Existing Control Measures | Further Actions Required |

For Likelihood of occurrence, use: (1) Very Unlikely / (2) Unlikely / (3) Likely / (4) Very Likely
For Severity of harm, use: (1) Negligible / (2) Minor / (3) Moderate / (4) Major / (5) Catastrophic
For Risk Level, calculate as Likelihood × Severity and label as: Low (1–4) / Medium (5–9) / High (10–14) / Very High (15–25)

Make the risk assessment specific and realistic for a ${body.yearGroup} class doing: ${body.activity}.
Output only the markdown table — no title, no preamble, no explanation.`;
}

function buildRefinePrompt(result: string, instruction: string): string {
  return `You are an expert school health and safety officer. Modify the following risk assessment table based on this instruction: "${instruction}"

Current risk assessment:
${result}

Return the full updated risk assessment as a markdown table in the same format. Apply only the changes described. No preamble.`;
}

async function streamText(system: string, userContent: string) {
  const stream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: userContent }],
  });

  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
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
    }),
    { headers: { "Content-Type": "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff" } },
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body.action === "refine") {
    if (!body.result?.trim() || !body.instruction?.trim()) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    return streamText(
      "You are an expert school health and safety officer. Return only the updated risk assessment as a markdown table with no preamble.",
      buildRefinePrompt(body.result, body.instruction),
    );
  }

  if (!body.curriculum?.trim() || !body.yearGroup?.trim() || !body.activity?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  return streamText(
    "You are an expert school health and safety officer. Output only a markdown table — no title, no preamble, no explanation.",
    buildPrompt(body),
  );
}
