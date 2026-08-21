// The tools the assistant can route a teacher into, and the shape of what it
// fills in for them.
//
// BEHAVIOUR: prefill and open, not generate. The assistant picks the tool and
// extracts the fields; the teacher reviews them and presses Generate. So a
// misread request costs nothing, the teacher stays in control of what is spent,
// and there is no second generation path to maintain alongside the 35 routes.
// This is also exactly what the landing page (HeroShowcase.tsx) already depicts.
//
// ── The one rule that matters here ──────────────────────────────────────────
// These schemas describe each form's STATE, not its API request body. The two
// genuinely differ — LessonPlannerForm holds { mixed: boolean, yearGroup } and
// POSTs `yearGroup: mixed ? "Mixed" : yearGroup`, and title-cases `subject` on
// the way out. Prefill drives the form, and the form state is also what
// saveToolRun() persists as `input`, which is what /folders reads its Subject
// and Year facets from. Target the request body instead and resources file
// correctly but show "—" and vanish from those filters.
//
// Six tools this pass, chosen by traffic. Each schema is hand-checked against
// its route and its form, because the shapes really do vary: worksheet has no
// `topic` at all, quiz needs a discriminating `action`, lesson-planner requires
// `learningObjective`. Adding the seventh means reading its form, not guessing.
import { CURRICULA, YEAR_GROUPS } from "@/app/lib/formOptions";

const CURRICULUM_VALUES = CURRICULA.map((c) => c.value);

/** Ability bands, shared by every tool that has an AbilityLevelField. */
const ABILITY_LEVELS = ["WTS", "EXS", "GDS"] as const;
/** Output length, shared by every tool with an OutputDetailField. */
const OUTPUT_DETAILS = ["condensed", "standard", "detailed"] as const;

export interface AssistantTool {
  /** Tool slug — also the route segment and the tool_runs / folder key. */
  slug: string;
  /** Shown on the ToolLinkCard. */
  label: string;
  /** Icon name for ToolIcon, matching the entry in tools.ts. */
  icon: string;
  /** Tells the model when to choose this tool over the others. */
  description: string;
  /** JSON Schema for the form-state fields the assistant may fill. */
  fields: Record<string, unknown>;
}

// Fields common to the curriculum-based tools. `mixed` is deliberately absent:
// it is a UI toggle for mixed-year classes, and the model has no reliable way
// to infer it from a sentence. It defaults to false in every form.
const curriculumFields = {
  curriculum: {
    type: "string",
    enum: CURRICULUM_VALUES,
    description:
      "The curriculum. Default to '2014 National Curriculum' unless the teacher " +
      "names a Scottish, Welsh, Northern Irish or Early Years context.",
  },
  yearGroup: {
    type: "string",
    enum: YEAR_GROUPS,
    description: "The year group, e.g. 'Year 4'. Omit if the teacher did not say.",
  },
  subject: {
    type: "string",
    description: "Curriculum subject, e.g. 'Science', 'Maths', 'English'.",
  },
} as const;

const abilityField = {
  type: "string",
  enum: ABILITY_LEVELS,
  description:
    "Ability band: WTS (working towards), EXS (expected), GDS (greater depth). " +
    "Omit unless the teacher signals it.",
} as const;

const detailField = {
  type: "string",
  enum: OUTPUT_DETAILS,
  description: "How comprehensive the output should be. Omit unless asked.",
} as const;

export const ASSISTANT_TOOLS: AssistantTool[] = [
  {
    slug: "lesson-planner",
    label: "Lesson Planner",
    icon: "planner",
    description:
      "A full lesson plan: objectives, activities, resources, assessment. Use for " +
      "any request for a lesson, a lesson plan, or 'how do I teach X'.",
    fields: {
      type: "object",
      properties: {
        ...curriculumFields,
        topic: {
          type: "string",
          description: "What the lesson is about, e.g. 'The Water Cycle'.",
        },
        learningObjective: {
          type: "string",
          description:
            "What pupils should be able to do by the end. Write one if the teacher " +
            "did not state it, phrased as a teacher would ('Identify the stages of " +
            "the water cycle').",
        },
        abilityLevel: abilityField,
        outputDetail: detailField,
      },
      required: ["subject", "topic"],
    },
  },
  {
    slug: "worksheet-generator",
    label: "Worksheet Generator",
    icon: "worksheet",
    description:
      "A printable worksheet of practice questions. Use for 'worksheet', " +
      "'practice questions', or 'activity sheet'.",
    fields: {
      type: "object",
      properties: {
        ...curriculumFields,
        // NOTE: no `topic` — this form genuinely does not have one. The subject
        // matter belongs in learningObjective.
        learningObjective: {
          type: "string",
          description:
            "What the worksheet practises, e.g. 'Multiply two-digit numbers by " +
            "one-digit numbers'. This carries the topic — there is no separate " +
            "topic field on this tool.",
        },
        questionCount: {
          type: "integer",
          minimum: 1,
          maximum: 40,
          description: "How many questions. Defaults to 10.",
        },
        abilityLevel: abilityField,
        outputDetail: detailField,
      },
      required: ["subject", "learningObjective"],
    },
  },
  {
    slug: "quiz-generator",
    label: "Quiz Generator",
    icon: "quiz",
    description:
      "A multiple-choice quiz, exportable to Kahoot, Blooket, Gimkit and others. " +
      "Use for 'quiz', 'multiple choice', or 'test them on X'.",
    fields: {
      type: "object",
      properties: {
        ...curriculumFields,
        topic: {
          type: "string",
          description: "What the quiz covers, e.g. 'Multiplication'.",
        },
        numQuestions: {
          type: "integer",
          minimum: 1,
          maximum: 30,
          description: "How many questions. Defaults to 10.",
        },
      },
      required: ["subject", "topic"],
    },
  },
  {
    slug: "comprehension-generator",
    label: "Comprehension Generator",
    icon: "comprehension",
    description:
      "A reading passage with comprehension questions. Use for 'comprehension', " +
      "'reading passage', or 'text with questions'.",
    fields: {
      type: "object",
      properties: {
        // No `subject`: this form has no subject field — a comprehension is
        // pitched by year group and topic alone. Spreading curriculumFields
        // here would advertise a field with nowhere to land.
        curriculum: curriculumFields.curriculum,
        yearGroup: curriculumFields.yearGroup,
        topic: {
          type: "string",
          description: "What the passage is about, e.g. 'Volcanoes'.",
        },
        numQuestions: {
          type: "integer",
          minimum: 1,
          maximum: 20,
          description: "How many questions. Omit to use the form's default.",
        },
      },
      required: ["topic"],
    },
  },
  {
    slug: "letter-writer",
    label: "Letter Writer",
    icon: "letter-writer",
    description:
      "A letter or email to parents, carers, governors or staff. Use for 'letter', " +
      "'email home', 'newsletter to parents', or 'write to the governors'.",
    fields: {
      type: "object",
      properties: {
        recipient: {
          type: "string",
          description: "Who it is addressed to, e.g. 'parents', 'governors'.",
        },
        content: {
          type: "string",
          description:
            "The key information the letter must convey — the teacher's brief, " +
            "restated as a clear instruction of what to include.",
        },
        tone: {
          type: "string",
          enum: ["Formal", "Semi-formal", "Informal"],
          description: "Register. Defaults to Semi-formal.",
        },
      },
      required: ["recipient", "content"],
    },
  },
  {
    slug: "homework-generator",
    label: "Homework Generator",
    icon: "homework",
    description:
      "A homework task with optional answers. Use for 'homework', 'home learning', " +
      "or 'something to send home'.",
    fields: {
      type: "object",
      properties: {
        ...curriculumFields,
        learningObjective: {
          type: "string",
          description:
            "What the homework practises. This carries the topic — there is no " +
            "separate topic field on this tool.",
        },
        abilityLevel: abilityField,
      },
      required: ["subject", "learningObjective"],
    },
  },
];

/** Look up a tool by slug. Returns undefined for anything not wired up. */
export function assistantToolFor(slug: string): AssistantTool | undefined {
  return ASSISTANT_TOOLS.find((t) => t.slug === slug);
}

/**
 * The tool-selection function definition sent to OpenAI.
 *
 * One function with a `slug` discriminator rather than six separate functions:
 * the model picks the tool and its fields in a single decision, and adding a
 * seventh tool is a registry entry rather than another schema wired into the
 * request. `fields` is deliberately loose here — per-tool validation happens in
 * toolPrefill.ts, against the schema above, after the model has answered.
 */
export function prefillFunctionDef() {
  const summary = ASSISTANT_TOOLS.map(
    (t) => `- ${t.slug}: ${t.description}`,
  ).join("\n");

  return {
    type: "function" as const,
    function: {
      name: "prefill_tool",
      description:
        "Open one of Jooma's tools with its form already filled in from the " +
        "teacher's request. Call this ONLY when the teacher is asking for a " +
        "resource one of these tools produces. For advice, explanation, or " +
        "discussion, answer normally instead of calling this.\n\n" +
        `Available tools:\n${summary}`,
      parameters: {
        type: "object",
        properties: {
          slug: {
            type: "string",
            enum: ASSISTANT_TOOLS.map((t) => t.slug),
            description: "Which tool to open.",
          },
          fields: {
            type: "object",
            description:
              "Form fields to prefill, matching the chosen tool's schema. Fill " +
              "everything the teacher stated or clearly implied; leave the rest " +
              "out rather than guessing.",
            additionalProperties: true,
          },
        },
        required: ["slug", "fields"],
      },
    },
  };
}

/**
 * The per-tool schemas, rendered for the system prompt.
 *
 * The function definition above advertises the tools; this tells the model what
 * each one's fields actually are, which is what keeps it from inventing a
 * `topic` for worksheet-generator.
 */
export function toolSchemaDigest(): string {
  return ASSISTANT_TOOLS.map((t) => {
    const props = (t.fields as { properties: Record<string, { description?: string }> }).properties;
    const required = (t.fields as { required?: string[] }).required ?? [];
    const lines = Object.entries(props).map(([name, spec]) => {
      const req = required.includes(name) ? " (required)" : "";
      return `    ${name}${req}: ${spec.description ?? ""}`;
    });
    return `  ${t.slug}\n${lines.join("\n")}`;
  }).join("\n\n");
}
