/* eslint-disable @next/next/no-img-element */

/**
 * The tools that have a redesigned flat icon, as a key set.
 *
 * Each key maps to `/icons/v2/<key>.svg`, so the path is derived rather than
 * written twice: a new tool needs its key added here and a file dropped into
 * `public/icons/v2/`. See `docs/tool-icon-style.md` for the design rules.
 *
 * This used to be a key -> V1 path map, kept after the redesign even though
 * `iconSrc` had stopped reading the values. Those 41 V1 files are deleted, so
 * the paths went with them.
 */
const TOOL_ICON_NAMES = new Set([
  "comprehension",
  "planner",
  "worksheet",
  "cover-lesson",
  "topic",
  "medium-term",
  "eyfs",
  "model-text",
  "sensory",
  "phonics",
  "exam",
  "model-answer",
  "homework",
  "intervention",
  "quiz",
  "report",
  "smart-targets",
  "cpd-slideshow",
  "policy",
  "one-page-profile",
  "risk-assessment",
  "behaviour-support-plan",
  "ect-report",
  "eyfs-action-plan",
  "inspection-prep",
  "learning-walk",
  "lesson-observation",
  "meeting-planner",
  "performance-management",
  "letter-writer",
  "pupil-premium",
  "assembly",
  "newsletter",
  "sip",
  "presentation",
]);

function iconSrc(name: string): string | undefined {
  if (!TOOL_ICON_NAMES.has(name)) return undefined;
  return `/icons/v2/${name}.svg`;
}

export default function ToolIcon({ name, className }: { name: string; className?: string }) {
  const src = iconSrc(name);
  if (!src) return null;
  const sizeClass = (className ?? "")
    .split(" ")
    .filter((c) => !c.startsWith("text-"))
    .join(" ");
  return <img src={src} alt="" className={sizeClass} />;
}
