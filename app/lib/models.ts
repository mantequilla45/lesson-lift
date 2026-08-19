// The model registry — one list of every model this app may call, with the
// pricing used to compute exact cost telemetry.
//
// This is the single source of truth. `PRICING` in app/lib/usage.ts derives
// from it rather than keeping a second table, and the admin Tools dropdown is
// built from it, so a model cannot exist in the UI but not in the cost maths.
//
// Which model a given tool actually uses is NOT decided here — that is a
// per-tool runtime setting in tool_settings, read by app/lib/tool-model.ts.
//
// Keep in sync with https://developers.openai.com/api/docs/pricing and the
// figures in docs/tool-costs.md.

/** Every model an admin may select. `gpt-5.6-sol` is deliberately absent: at
 *  $5/$30 per 1M it is 3x gpt-4o's output rate, with no fit for these writing
 *  tools. The database enforces the same list (tool_settings_model_chk). */
export type ModelId =
  | "gpt-4o"
  | "gpt-4o-2024-08-06"
  | "gpt-4o-mini"
  | "gpt-5.6-terra"
  | "gpt-5.6-luna";

export interface ModelSpec {
  /** Shown in the admin dropdown. */
  label: string;
  /** `reasoning` models take reasoning_effort/verbosity and reject temperature. */
  family: "chat" | "reasoning";
  /** USD per 1M tokens. */
  input: number;
  cachedInput: number;
  /** Explicit-cache writes, gpt-5.6 only — 1.25x input. Undefined on gpt-4o. */
  cacheWrite?: number;
  output: number;
  /** Roughly what this model is for, shown as help text under the dropdown. */
  note: string;
}

export const MODELS: Record<ModelId, ModelSpec> = {
  "gpt-4o": {
    label: "GPT-4o",
    family: "chat",
    input: 2.5,
    cachedInput: 1.25,
    output: 10,
    note: "Current default for writing tools.",
  },
  "gpt-4o-2024-08-06": {
    label: "GPT-4o (2024-08-06)",
    family: "chat",
    input: 2.5,
    cachedInput: 1.25,
    output: 10,
    note: "Pinned snapshot. Used where a strict JSON schema must not drift.",
  },
  "gpt-4o-mini": {
    label: "GPT-4o mini",
    family: "chat",
    input: 0.15,
    cachedInput: 0.075,
    output: 0.6,
    note: "Cheapest 4o. Short utility calls.",
  },
  "gpt-5.6-terra": {
    label: "GPT-5.6 Terra",
    family: "reasoning",
    input: 2,
    cachedInput: 0.2,
    cacheWrite: 2.5,
    output: 12,
    note: "Reasoning model. Cheaper input than 4o but DEARER output — check the projection.",
  },
  "gpt-5.6-luna": {
    label: "GPT-5.6 Luna",
    family: "reasoning",
    input: 0.2,
    cachedInput: 0.02,
    cacheWrite: 0.25,
    output: 1.2,
    note: "Reasoning model, ~8x cheaper than 4o. Best candidate for cost savings.",
  },
};

/** Order shown in the admin dropdown: current defaults first, then the new
 *  options cheapest-first, so the saving is the easy choice to reach for. */
export const SELECTABLE_MODELS: ModelId[] = [
  "gpt-4o",
  "gpt-4o-2024-08-06",
  "gpt-4o-mini",
  "gpt-5.6-luna",
  "gpt-5.6-terra",
];

export const REASONING_EFFORTS = ["none", "low", "medium", "high", "xhigh", "max"] as const;
export const VERBOSITIES = ["low", "medium", "high"] as const;

export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];
export type Verbosity = (typeof VERBOSITIES)[number];

/**
 * Default reasoning effort.
 *
 * The API's own default is `medium`. We deliberately use `low`: reasoning
 * tokens bill as OUTPUT tokens, and on a tool generating 8k tokens of prose
 * that is where terra stops being competitive with gpt-4o. These are writing
 * tools, not maths problems — a live probe confirmed luna produces clean
 * teacher-facing copy even at `none`.
 */
export const DEFAULT_EFFORT: ReasoningEffort = "low";
export const DEFAULT_VERBOSITY: Verbosity = "medium";

export function isKnownModel(m: string): m is ModelId {
  return Object.hasOwn(MODELS, m);
}

/** True for gpt-5.6 models, which take reasoning_effort/verbosity and reject a
 *  non-default temperature. Unknown models are treated as `chat` — the
 *  conservative answer, since it sends no extra params. */
export function isReasoning(model: string): boolean {
  return isKnownModel(model) && MODELS[model].family === "reasoning";
}

export function modelLabel(model: string): string {
  return isKnownModel(model) ? MODELS[model].label : model;
}

/**
 * Tag tone for a model name — green marks a cheap model, so a column of green
 * chips reads as "well routed" at a glance.
 *
 * Replaces a `.includes("mini")` test that predated gpt-5.6 and would have left
 * luna — the cheapest model available — rendered as if it were a frontier one.
 * The threshold is on the OUTPUT rate, which dominates the bill for these
 * long-form writing tools.
 *
 * Lives here rather than in a component because three admin surfaces need it
 * (Model routing, Tools, Activity).
 */
export function cheapModelTone(model: string): "ok" | "plain" {
  return isKnownModel(model) && MODELS[model].output <= 2 ? "ok" : "plain";
}

/**
 * Narrow a resolved model to the shape the installed OpenAI SDK accepts.
 *
 * openai@6 predates gpt-5.6, so its ChatCompletionReasoningEffort union omits
 * `xhigh` and `max` — both of which the API does accept. Values here are
 * constrained by REASONING_EFFORTS above and by a CHECK constraint in the
 * database, so the widening is safe.
 *
 * Only needed by callers that hand params straight to the SDK; streamChat and
 * createCompletion already do this internally. Delete once the SDK catches up.
 */
export function forSdk<T extends { reasoning_effort?: string; verbosity?: string }>(
  resolved: T,
): Omit<T, "reasoning_effort" | "verbosity"> & {
  reasoning_effort?: "low" | "medium" | "high" | "minimal";
  verbosity?: "low" | "medium" | "high";
} {
  return resolved as never;
}
