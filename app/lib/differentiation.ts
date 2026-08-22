// Opt-in differentiation, shared by the field component and every tool route.
//
// Replaces the old always-on `abilityLevel` single-select. Two things changed:
// the teacher now opts IN (default "no"), and they pick any combination of the
// four attainment bands rather than exactly one.
//
// Both halves of the feature read this file so the enum cannot drift: the
// control renders DIFFERENTIATION_BANDS, and assistant-tools.ts imports
// DIFFERENTIATION_VALUES for its JSON Schema. That file's own rule 3 warns that
// a hand-copied option list which falls out of sync makes validatePrefill drop
// the value and the control render blank — so nothing here gets copied.

/** The four bands, in ascending attainment order. Drives the control. */
export const DIFFERENTIATION_BANDS = [
  { value: "WBS", label: "WBS", detail: "Working Below Standard" },
  { value: "WTS", label: "WTS", detail: "Working Towards Standard" },
  { value: "EXS", label: "EXS", detail: "Expected Standard" },
  { value: "GDS", label: "GDS", detail: "Greater Depth Standard" },
] as const;

/** Just the values — for JSON Schema enums and validation. */
export const DIFFERENTIATION_VALUES = ["WBS", "WTS", "EXS", "GDS"] as const;

export type DifferentiationBand = (typeof DIFFERENTIATION_VALUES)[number];

/** Whether differentiation is switched on. */
export type Differentiate = "yes" | "no";

/** Full names, for naming the bands in prose. */
const BAND_NAMES: Record<string, string> = {
  WBS: "Working Below Standard",
  WTS: "Working Towards Standard",
  EXS: "Expected Standard",
  GDS: "Greater Depth Standard",
};

/**
 * What each band needs from the adaptation section. These are blended into one
 * instruction rather than emitted as separate blocks — a teacher picking three
 * bands wants one section they can read for a mixed class, not three to
 * reconcile.
 */
const BAND_GUIDANCE: Record<string, string> = {
  WBS:
    "pupils working below the standard, who need significantly simplified access to the same learning — " +
    "heavily scaffolded steps, pre-taught vocabulary, concrete or practical representations, and reduced " +
    "reading and recording demands, without reducing the material to busywork",
  WTS:
    "pupils working towards the standard, who need targeted scaffolding — graphic organisers, sentence " +
    "frames, partially completed worked examples, or modified task demands that maintain access to the " +
    "learning objective without removing cognitive challenge",
  EXS:
    "pupils at the expected standard, for whom the section should describe what successful engagement " +
    "looks like and how to keep them on track and appropriately challenged throughout",
  GDS:
    "pupils working at greater depth, who need extension that deepens understanding rather than simply " +
    "accelerating pace — higher-order thinking, independent enquiry, justification, or links to " +
    "examination-level challenge",
};

/** Canonical order, regardless of the order the teacher clicked them in. */
function ordered(levels: string[]): DifferentiationBand[] {
  const chosen = new Set(levels);
  return DIFFERENTIATION_VALUES.filter((b) => chosen.has(b));
}

/** "WBS, WTS and GDS" — for naming the selection in prose. */
function joinBands(bands: readonly string[]): string {
  if (bands.length === 1) return bands[0];
  return `${bands.slice(0, -1).join(", ")} and ${bands[bands.length - 1]}`;
}

/**
 * The prompt fragment for a tool's adaptation section.
 *
 * Returns "" when differentiation is off, when nothing was selected, and when
 * nothing selected was a recognised band — so a caller can treat empty as "omit
 * the whole section, heading included". Emitting an empty heading instead is
 * the failure this guards against: it reads as a section the model forgot to
 * fill in.
 */
export function differentiationPrompt(
  differentiate: Differentiate | undefined,
  levels: string[] | undefined,
): string {
  if (differentiate !== "yes") return "";
  if (!Array.isArray(levels) || levels.length === 0) return "";

  const bands = ordered(levels);
  if (bands.length === 0) return "";

  const detail = bands
    .map((b) => `- **${b} (${BAND_NAMES[b]})**: ${BAND_GUIDANCE[b]}`)
    .join("\n");

  const scope =
    bands.length === 1
      ? `pitched for ${bands[0]} (${BAND_NAMES[bands[0]]}) pupils`
      : `covering a mixed group spanning ${joinBands(bands)}`;

  return (
    `Write a SINGLE, blended adaptation section ${scope}. Do not write one ` +
    `separate block per band and do not use the band codes as sub-headings — ` +
    `write it as continuous, practical guidance a teacher can act on for the ` +
    `class as a whole, weaving in the following needs:\n\n${detail}\n\n` +
    `Reference specific adjustments rather than generic statements.`
  );
}

/**
 * Read the two fields back out of a saved tool run.
 *
 * Runs saved before differentiation became opt-in hold the old single-select
 * `abilityLevel` string instead. Those reopen as "yes" with that one band, so a
 * past run still shows the differentiation it was generated with rather than
 * silently coming back switched off.
 */
export function restoreDifferentiation(
  input: Record<string, unknown>,
): { differentiate: Differentiate; levels: string[] } {
  const legacy = typeof input.abilityLevel === "string" ? input.abilityLevel : undefined;

  const saved = input.differentiate;
  const differentiate: Differentiate =
    saved === "yes" || saved === "no" ? saved : legacy ? "yes" : "no";

  const savedLevels = Array.isArray(input.differentiationLevels)
    ? (input.differentiationLevels as unknown[]).filter(
        (v): v is string => typeof v === "string",
      )
    : undefined;

  return {
    differentiate,
    levels: savedLevels ?? (legacy ? [legacy] : []),
  };
}

/**
 * The one-line summary some prompts want alongside the full section (e.g. in a
 * bulleted list of the request parameters). Empty when differentiation is off.
 */
export function differentiationSummary(
  differentiate: Differentiate | undefined,
  levels: string[] | undefined,
): string {
  if (differentiate !== "yes") return "";
  if (!Array.isArray(levels) || levels.length === 0) return "";

  const bands = ordered(levels);
  if (bands.length === 0) return "";

  return bands.map((b) => `${b} (${BAND_NAMES[b]})`).join(", ");
}
