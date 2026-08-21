"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Card from "@/app/components/ui/Card";
import { extractHeadings } from "@/app/lib/headings";

// Chapter navigation for a generated document, derived from the output itself.
//
// Replaces LessonPlannerNav, EYFSNav, WorksheetNav and SensoryActivitiesNav,
// which between them covered 4 of 32 markdown tools and each hardcoded the
// section names they expected, locating them by scanning the live DOM for an
// <h2> whose text started with the right string. Two consequences teachers hit:
// a heading the model phrased differently was unreachable, and editing a
// heading in the Tiptap editor silently broke its own link.

/** Offset so a scrolled-to heading clears the sticky results header. Matches
 *  the value the four hardcoded navs used. */
const SCROLL_OFFSET = 160;

interface Props {
  /** The generated markdown. The outline re-derives whenever this changes, so
   *  it tracks edits for free. */
  markdown: string | null;
  /** Scroll container for the results. Defaults to the window. */
  title?: string;
}

export default function OutputOutline({ markdown, title = "Jump to section" }: Props) {
  const headings = useMemo(
    // Empty headings still occupy an index (see headings.ts) but have nothing
    // to label, so they are dropped here rather than from the id sequence.
    () => extractHeadings(markdown ?? "").filter((h) => h.text !== ""),
    [markdown],
  );

  const [activeId, setActiveId] = useState<string | null>(null);
  // Suppresses the observer while a click-driven smooth scroll is in flight —
  // otherwise passing over intermediate headings would flicker the highlight
  // through them before settling.
  const scrollingTo = useRef<string | null>(null);

  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (scrollingTo.current) return;
        // Whichever tracked heading is nearest the top of the viewport wins.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) setActiveId(visible[0].target.id);
      },
      {
        // Top band of the viewport: a heading counts as "current" once it
        // reaches the reading position, not when it first peeks into view.
        rootMargin: `-${SCROLL_OFFSET}px 0px -65% 0px`,
        threshold: 0,
      },
    );

    // Only headings that actually rendered ids — the Tiptap editor replaces
    // MarkdownResult once generation finishes and emits none, in which case
    // there is nothing to observe and the positional fallback in `scrollTo`
    // takes over.
    const observed = headings
      .map((h) => document.getElementById(h.id))
      .filter((el): el is HTMLElement => el !== null);
    observed.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [headings]);

  /**
   * Scroll to a heading.
   *
   * Two strategies, in order:
   *   1. getElementById — works while MarkdownResult is rendering the output.
   *   2. The nth heading in document order — the fallback once ResultPanel has
   *      swapped in the Tiptap editor, whose ProseMirror DOM carries no ids.
   *      Positional, so it keeps working after the teacher edits the heading
   *      text, which is exactly what broke the navs this replaces.
   */
  const scrollTo = (id: string, index: number) => {
    // `.prose-editor` is the class RichTextEditor gives Tiptap's editable node
    // (see its editorProps); scoping to it avoids counting headings from the
    // page chrome — "My results", the sidebar panels — which a bare h1/h2/h3
    // query would include, throwing the index off.
    const target =
      document.getElementById(id) ??
      document.querySelectorAll<HTMLElement>(
        ".prose-editor h1, .prose-editor h2, .prose-editor h3",
      )[index];

    if (!target) return;

    setActiveId(id);
    scrollingTo.current = id;
    window.scrollTo({
      top: target.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET,
      behavior: "smooth",
    });
    // Long enough for a smooth scroll to settle before the observer resumes.
    window.setTimeout(() => {
      scrollingTo.current = null;
    }, 700);
  };

  // One heading is a title, not an outline — nothing to navigate between.
  if (headings.length < 2) return null;

  // Nest ### under ## only when the document actually mixes levels; a flat list
  // of ### headings should not all sit indented.
  const minLevel = Math.min(...headings.map((h) => h.level));

  return (
    <Card className="p-5">
      <p className="text-xs font-semibold text-(--color-muted) uppercase tracking-wide mb-3">
        {title}
      </p>
      <nav className="space-y-0.5 max-h-[60vh] overflow-y-auto">
        {headings.map((h) => {
          const active = h.id === activeId;
          return (
            <button
              key={h.id}
              type="button"
              onClick={() => scrollTo(h.id, h.index)}
              aria-current={active ? "location" : undefined}
              title={h.text}
              className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors cursor-pointer truncate ${
                active
                  ? "bg-[#1a1a1a] text-white font-medium"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
              style={{ paddingLeft: `${12 + (h.level - minLevel) * 14}px` }}
            >
              {h.text}
            </button>
          );
        })}
      </nav>
    </Card>
  );
}
