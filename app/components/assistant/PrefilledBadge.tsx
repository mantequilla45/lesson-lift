import { Sparkles } from "lucide-react";

/**
 * Marks a form the assistant filled in.
 *
 * Matters for trust as much as for information: the teacher needs to see at a
 * glance that these values were inferred from a sentence and are theirs to
 * correct, not settings they chose. Same treatment and colours as the landing
 * page demo (HeroShowcase.tsx → LessonPlannerToolView).
 */
export default function PrefilledBadge() {
  return (
    <div
      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold w-fit"
      style={{ backgroundColor: "#EAEFF7", color: "#3B6FF5" }}
    >
      <Sparkles className="w-3 h-3" />
      Auto-filled from your request — check before generating
    </div>
  );
}
