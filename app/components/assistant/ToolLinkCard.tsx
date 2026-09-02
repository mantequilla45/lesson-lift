"use client";

import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { ToolTile } from "@/app/components/v2/Squircle";
import { assistantToolFor } from "@/app/lib/assistant-tools";
import { v2ToolForSlug, toolSolid } from "@/app/lib/tools";
import { prefillHref, type ToolPrefill } from "@/app/lib/toolPrefill";

/**
 * The card beneath a Jo reply that opens a tool, prefilled.
 *
 * This is the moment the assistant hands back to the rest of the product, so it
 * uses the same squircle tile and the same tool name as Make and Library. A
 * teacher should recognise the tile before they read the label.
 */
export default function ToolLinkCard({ prefill }: { prefill: ToolPrefill }) {
  const tool = assistantToolFor(prefill.slug);
  // Unknown slug should be impossible — validatePrefill rejects those before a
  // card is ever built — but rendering nothing beats rendering a broken link.
  if (!tool) return null;

  // The V2 join carries the short name and the Phosphor icon. Falls back to the
  // assistant's own label if a tool has no V2 entry yet.
  const v2 = v2ToolForSlug(prefill.slug);

  return (
    <Link
      href={prefillHref(prefill)}
      className="mt-2.5 flex items-center gap-2.5 rounded-xl border px-3 py-2 transition-all hover:shadow-sm"
      style={{ borderColor: "var(--j-line)", backgroundColor: "var(--j-card)" }}
    >
      <ToolTile icon={v2?.icon ?? "file-text"} solid={toolSolid(v2)} size="xs" />
      <div className="min-w-0 flex-1">
        <p
          className="text-[12px] font-bold leading-tight truncate"
          style={{ color: "var(--j-ink)" }}
        >
          {v2?.name ?? tool.label}
        </p>
        <p className="text-[10px]" style={{ color: "var(--j-faint)" }}>
          Opens the tool, filled in for you
        </p>
      </div>
      <span
        className="flex items-center gap-1 text-[11px] font-bold shrink-0"
        style={{ color: "var(--j-purple)" }}
      >
        Open <ArrowRight className="w-3 h-3" />
      </span>
    </Link>
  );
}
