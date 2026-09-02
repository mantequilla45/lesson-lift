"use client";

import { useRouter } from "next/navigation";
import { assistantToolFor } from "@/app/lib/assistant-tools";
import { v2ToolForSlug } from "@/app/lib/tools";
import { prefillHref, validatePrefill, type ToolClarify } from "@/app/lib/toolPrefill";

/**
 * The one question Jo asks before opening a tool.
 *
 * The handover calls this out as one of the two behaviours that make Jo feel
 * like an assistant rather than a slot machine: when a field a tool needs is
 * genuinely ambiguous, guessing burns a generation and teaches teachers not to
 * trust it.
 *
 * Three rules hold this to being helpful rather than an interrogation:
 *
 *   1. It never asks twice. Answering navigates to the tool, so the question
 *      cannot chain into a second one.
 *   2. "Just build it" is always here, added by the client rather than the
 *      model, so the escape is always present and always worded the same. It
 *      opens the tool with what was already understood, letting the teacher
 *      finish the field themselves.
 *   3. Both routes land in the SAME validated prefill the tool card uses, so
 *      there is no second path into a form to keep correct.
 */
export default function ClarifyChips({ clarify }: { clarify: ToolClarify }) {
  const router = useRouter();

  const tool = assistantToolFor(clarify.slug);
  // Unknown slug should be impossible: validateClarify rejects those. Rendering
  // nothing beats rendering a question that leads somewhere broken.
  if (!tool) return null;

  const v2 = v2ToolForSlug(clarify.slug);
  const toolName = v2?.name ?? tool.label;

  /**
   * Open the tool with the answer filled in.
   *
   * `answer` is null for "Just build it", which opens with only what was
   * already understood. Either way the payload goes through validatePrefill, so
   * a chip cannot put anything in a form that a model reply could not.
   */
  const open = (answer: string | null) => {
    const fields = answer === null
      ? clarify.fields
      : { ...clarify.fields, [clarify.field]: answer };

    const prefill = validatePrefill({ slug: clarify.slug, fields });
    if (!prefill) return;
    router.push(prefillHref(prefill));
  };

  return (
    <div className="mt-2.5">
      <p className="text-[12px] font-bold leading-snug" style={{ color: "var(--j-ink)" }}>
        {clarify.question}
      </p>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {clarify.options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => open(option.value)}
            className="rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors hover:bg-(--j-tint)"
            style={{ borderColor: "var(--j-line-2)", color: "var(--j-purple)" }}
          >
            {option.label}
          </button>
        ))}

        {/* The escape. Quieter than the options because picking one is the
            better outcome, but never hidden: a teacher who was already clear
            must be able to get past the question in one click. */}
        <button
          type="button"
          onClick={() => open(null)}
          className="rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors hover:bg-(--j-tint)"
          style={{ color: "var(--j-muted)" }}
        >
          Just build it
        </button>
      </div>

      <p className="mt-1.5 text-[10px]" style={{ color: "var(--j-faint)" }}>
        Opens {toolName}, filled in for you
      </p>
    </div>
  );
}
