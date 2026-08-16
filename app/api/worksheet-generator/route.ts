import { NextRequest, NextResponse } from "next/server";
import { streamChat } from "@/app/lib/usage";
import { modelFor } from "@/app/lib/tool-model";
import { buildSystem } from "@/app/lib/systemPrompt";

export interface WorksheetRequest {
  curriculum: string;
  yearGroup: string;
  subject: string;
  learningObjective: string;
  questionTypes?: string[];
  questionCount?: number;
  abilityLevel?: string;
  outputDetail?: "condensed" | "standard" | "detailed";
  additionalInfo?: string | null;
}


export async function POST(req: NextRequest) {
  const body: WorksheetRequest = await req.json();

  const {
    curriculum,
    yearGroup,
    subject,
    learningObjective,
    questionTypes = [],
    questionCount = 10,
    abilityLevel = "EXS",
    outputDetail = "detailed",
    additionalInfo,
  } = body;

  if (!curriculum || !yearGroup || !subject?.trim() || !learningObjective?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const detailPreamble =
    outputDetail === "condensed"
      ? "Produce a concise worksheet. Keep questions brief and mark schemes compact.\n\n"
      : outputDetail === "standard"
      ? "Produce a well-structured worksheet with clear questions and guidance. Balance brevity with clarity.\n\n"
      : "";

  const typesLine = questionTypes.length
    ? `QUESTION FORMAT CONSTRAINT — this overrides any format suggested by the section descriptions below: every question in every section must be written as one of these question types ONLY: ${questionTypes.join(", ")}. Do not use any other question format. Adapt each section's cognitive demand (recall, understanding, application, analysis) to the chosen formats — for example, a Multiple Choice question can still assess analysis through carefully designed options and distractors.`
    : "";

  const abilityLine =
    abilityLevel === "WTS"
      ? "Pitch the questions for Working Towards Standard (WTS) students — use accessible language, provide sentence starters or scaffolding where helpful, and avoid unnecessary complexity."
      : abilityLevel === "GDS"
      ? "Pitch the questions for Greater Depth Standard (GDS) students — include higher-order thinking, open-ended challenge, and questions that require justification or extension beyond the objective."
      : "Pitch the questions at the Expected Standard (EXS) — appropriate challenge for most students in this year group.";

  const additionalLine = additionalInfo ? `\nAdditional instructions: ${additionalInfo}` : "";

  const sectionA = Math.round(questionCount * 0.35);
  const sectionB = Math.round(questionCount * 0.3);
  const sectionC = Math.round(questionCount * 0.2);
  const sectionD = questionCount - sectionA - sectionB - sectionC;

  const userPrompt = `${detailPreamble}Create a high-quality, classroom-ready worksheet for the following:

- Curriculum: ${curriculum}
- Year Group: ${yearGroup}
- Subject: ${subject}
- Learning Objective: ${learningObjective}
- Total questions: approximately ${questionCount}
- ${abilityLine}
- ${typesLine}${additionalLine}

This worksheet is for use in a UK school. Questions must build progressively from knowledge recall through to higher-order thinking, in line with Bloom's Taxonomy. Number all questions sequentially within each section. When labelling sub-questions use plain text: (a), (b), (c) — never use the © symbol.

Structure the worksheet using markdown as follows:

# [Worksheet Title — specific to the topic, not generic]

**Curriculum:** ${curriculum} | **Year Group:** ${yearGroup} | **Subject:** ${subject}

**Learning Objective:** [Restate in student-facing language beginning with "I am learning to..."]

**Name:** ______________________________ **Date:** ______________ **Class:** ______________

---

## Section A – Knowledge Recall [1 mark each]

Write approximately ${sectionA} questions testing recall of key facts, definitions, or processes, using only the selected question types. These should be the most accessible questions. Where a selected type requires a written answer, show answer blanks as: ___________________________________

---

## Section B – Understanding [2 marks each]

Write approximately ${sectionB} questions requiring students to demonstrate understanding — explaining concepts, identifying relationships, or interpreting information — using only the selected question types. Include mark allocations in brackets, e.g. [2 marks].

---

## Section C – Application [3–4 marks each]

Write approximately ${sectionC} questions where students apply knowledge to a new scenario or context, using only the selected question types. Include a brief stimulus where appropriate. Include mark allocations.

---

## Section D – Analysis and Evaluation [6–8 marks]

Write approximately ${sectionD} higher-order questions demanding analysis, evaluation, justification, or argument, using only the selected question types. Where the selected types support extended writing (e.g. Essay / Open-Ended, Short Answer), require extended responses; otherwise design the most demanding questions possible within the chosen formats while still assessing analysis and evaluation. State mark allocation and include a note on what a strong response will include.

---

## Common Misconceptions

Provide 4–6 bullet points identifying the most common misconceptions students have about this topic. For each, briefly explain why the misconception occurs and how it can be addressed.

---

## Answer Key

Provide a comprehensive answer key for all sections:
- Section A: exact model answers
- Section B: mark scheme noting what earns each mark
- Section C: full model answers with annotations
- Section D: level descriptor or bullet-pointed mark scheme for full, partial, and no marks

Write in clear, professional language appropriate for ${yearGroup}. Do not use any emojis.`;

  return streamChat({
    toolSlug: "worksheet-generator",
    ...(await modelFor("worksheet-generator", "gpt-4o")),
    max_completion_tokens: 8192,
    messages: [
      { role: "system", content: buildSystem("You are an expert UK teacher and curriculum designer with extensive experience creating high-quality classroom worksheets for KS1 through KS5. You understand Bloom's Taxonomy, tiered questioning, and how to scaffold access without reducing challenge. Your worksheets are precisely pitched for the specified year group, subject-accurate, and built around a clear learning objective. You write in professional UK English and produce materials that could be used in any well-run UK school without amendment. Never use the © symbol — always write sub-question labels as plain text: (a), (b), (c), (d).") },
      { role: "user", content: userPrompt },
    ],
  });
}
