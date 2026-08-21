"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import ToolIcon from "@/app/components/ToolIcon";
import { assistantToolFor } from "@/app/lib/assistant-tools";
import { prefillHref, type ToolPrefill } from "@/app/lib/toolPrefill";

/**
 * The card beneath an assistant reply that opens a tool, prefilled.
 *
 * Styled to match the same card in the landing page demo
 * (app/components/landing/HeroShowcase.tsx → ToolLinkCard), so what a visitor
 * is shown before signing up is what they get after. The colours are the
 * literals that component uses.
 */
export default function ToolLinkCard({ prefill }: { prefill: ToolPrefill }) {
  const tool = assistantToolFor(prefill.slug);
  // Unknown slug should be impossible — validatePrefill rejects those before a
  // card is ever built — but rendering nothing beats rendering a broken link.
  if (!tool) return null;

  return (
    <Link
      href={prefillHref(prefill)}
      className="mt-2.5 flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-all hover:shadow-sm"
      style={{ borderColor: "#EDEAE0", backgroundColor: "#FFFFFF" }}
    >
      <ToolIcon name={tool.icon} className="w-7 h-7 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold leading-tight" style={{ color: "#1a1a1a" }}>
          {tool.label}
        </p>
        <p className="text-[10px]" style={{ color: "#8a8078" }}>
          Opens the tool, prefilled for you
        </p>
      </div>
      <span
        className="flex items-center gap-1 text-[11px] font-semibold shrink-0"
        style={{ color: "#c25034" }}
      >
        Open <ArrowRight className="w-3 h-3" />
      </span>
    </Link>
  );
}
