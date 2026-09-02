"use client";

import { Fragment, useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { usd, fmtDateTime } from "../../format";

interface ImageRow {
  label: string;
  cost_usd: number;
  count: number;
}
interface Breakdown {
  text: number;
  audio: number;
  /** Absent on decks generated before YouTube cost was folded into the total. */
  youtube?: number;
  images: ImageRow[];
}
export interface SlideRow {
  slide_label: string;
  cost_usd: number;
  created_at: string;
  breakdown?: Breakdown | null;
}

// Flatten a deck's stored breakdown into display lines (deck text, each slide's
// images, then audio, then the YouTube lookup). These lines sum to the deck's
// stored cost_usd. Empty when the row predates breakdown capture.
function lines(b: Breakdown | null | undefined): { label: string; cost_usd: number }[] {
  if (!b) return [];
  const out: { label: string; cost_usd: number }[] = [];
  if (b.text > 0) out.push({ label: "Deck text", cost_usd: b.text });
  for (const img of b.images ?? []) {
    out.push({
      label: `${img.label} · ${img.count} image${img.count === 1 ? "" : "s"}`,
      cost_usd: img.cost_usd,
    });
  }
  if (b.audio > 0) out.push({ label: "Audio (script + speech)", cost_usd: b.audio });
  // Optional: decks recorded before this was tracked have no `youtube` key.
  if ((b.youtube ?? 0) > 0) {
    out.push({ label: "YouTube (search query)", cost_usd: b.youtube! });
  }
  return out;
}

export default function SlideshowBreakdown({ slides }: { slides: SlideRow[] }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const total = slides.reduce((s, r) => s + Number(r.cost_usd), 0);

  const toggle = (i: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: "#FFFFFF", borderColor: "#EAE6F5" }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ color: "#6D6683" }} className="text-left">
            <th className="font-semibold px-4 py-3">Slideshow</th>
            <th className="font-semibold px-4 py-3">Generated</th>
            <th className="font-semibold px-4 py-3 text-right">Cost</th>
          </tr>
        </thead>
        <tbody>
          {slides.map((s, i) => {
            const rows = lines(s.breakdown);
            const hasBreakdown = rows.length > 0;
            const isOpen = expanded.has(i);
            return (
              <Fragment key={`${s.slide_label}:${i}`}>
                <tr
                  className="border-t"
                  style={{ borderColor: "#F1ECFC", cursor: hasBreakdown ? "pointer" : "default" }}
                  onClick={hasBreakdown ? () => toggle(i) : undefined}
                >
                  <td className="px-4 py-3 font-medium" style={{ color: "#1D1730" }}>
                    <div className="flex items-center gap-1.5">
                      {hasBreakdown ? (
                        isOpen ? (
                          <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                        )
                      ) : (
                        <span className="w-3.5 shrink-0" />
                      )}
                      {s.slide_label}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: "#6D6683" }}>
                    {fmtDateTime(s.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right" style={{ color: "#3C3552" }}>
                    {usd(Number(s.cost_usd))}
                  </td>
                </tr>
                {hasBreakdown &&
                  isOpen &&
                  rows.map((r, j) => (
                    <tr key={`${s.slide_label}:${i}:line:${j}`} style={{ backgroundColor: "#F1ECFC" }}>
                      <td className="pl-10 pr-4 py-2 text-sm" style={{ color: "#3C3552" }}>
                        {r.label}
                      </td>
                      <td />
                      <td className="px-4 py-2 text-right text-sm" style={{ color: "#3C3552" }}>
                        {usd(r.cost_usd)}
                      </td>
                    </tr>
                  ))}
              </Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2" style={{ borderColor: "#EAE6F5" }}>
            <td className="px-4 py-3 font-bold" style={{ color: "#1D1730" }}>
              Total
            </td>
            <td />
            <td className="px-4 py-3 text-right font-bold" style={{ color: "#1D1730" }}>
              {usd(total)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
