"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ArrowUp, X } from "lucide-react";
import { ChatTeardropDots } from "@phosphor-icons/react/dist/ssr";
import Card from "@/app/components/ui/Card";
import { extractHeadings, type Heading } from "@/app/lib/headings";
import styles from "./OutputOutline.module.css";

// Chapter navigation for a generated document, derived from the output itself.
//
// Replaces LessonPlannerNav, EYFSNav, WorksheetNav and SensoryActivitiesNav,
// which between them covered 4 of 32 markdown tools and each hardcoded the
// section names they expected, locating them by scanning the live DOM for an
// <h2> whose text started with the right string. Two consequences teachers hit:
// a heading the model phrased differently was unreachable, and editing a
// heading in the Tiptap editor silently broke its own link.
//
// Two presentations, one brain. On desktop this is the sticky sidebar card it
// has always been. Below the shell's 900px breakpoint the card is hidden and
// the same list is reached through a floating button, because stacked above a
// long document the card was just something to scroll past. Heading
// extraction, active tracking and scrolling are shared; only the frame differs.

/** Offset so a scrolled-to heading clears the sticky results header. Matches
 *  the value the four hardcoded navs used. */
const SCROLL_OFFSET = 160;

interface Props {
  /** The generated markdown. The outline re-derives whenever this changes, so
   *  it tracks edits for free. */
  markdown: string | null;
  /** Heading above the list. Also the floating button's accessible name. */
  title?: string;
}

/**
 * True only once hydration has happened, false on the server and on the
 * client's first render.
 *
 * The mobile half renders through a portal, which needs a real document. A
 * bare `typeof document === "undefined"` is NOT enough: it is false during the
 * client's first render too, so the client would render the button on a pass
 * where the server rendered nothing, which React reports as a hydration
 * mismatch. Same shape as the one in SupportLauncher.
 */
const subscribeToNothing = () => () => {};
function useMounted(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
}

export default function OutputOutline({ markdown, title = "Jump to section" }: Props) {
  const headings = useMemo(
    // Empty headings still occupy an index (see headings.ts) but have nothing
    // to label, so they are dropped here rather than from the id sequence.
    () => extractHeadings(markdown ?? "").filter((h) => h.text !== ""),
    [markdown],
  );

  const mounted = useMounted();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const fabRef = useRef<HTMLButtonElement | null>(null);
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

  // Escape closes the sheet, and the body stops scrolling behind it. Both are
  // scoped to `open`, so nothing is installed while the sheet is shut.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

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

  const list = (
    <OutlineList
      headings={headings}
      minLevel={minLevel}
      activeId={activeId}
      onPick={(h) => {
        // Close BEFORE scrolling, so the scrim is not animating away over the
        // movement. Harmless on desktop, where the sheet is never open.
        setOpen(false);
        scrollTo(h.id, h.index);
      }}
    />
  );

  return (
    <>
      <Card className={`p-5 ${styles.card}`}>
        <p className="text-xs font-semibold text-(--color-muted) uppercase tracking-wide mb-3">
          {title}
        </p>
        <nav className="space-y-0.5 max-h-[60vh] overflow-y-auto">{list}</nav>
      </Card>

      {/*
        Portalled to <body>. The 32 consumer forms mount this inside
        `lg:sticky lg:top-8`, and a position: fixed child of a sticky or
        transformed ancestor anchors to that ancestor rather than the viewport,
        which would strand the button mid-page.
      */}
      {mounted &&
        createPortal(
          <div className={styles.floating}>
            {open && (
              <>
                <div className={styles.scrim} onClick={() => setOpen(false)} />
                <div className={styles.sheet} role="dialog" aria-modal="true" aria-label={title}>
                  <div className={styles.sheetHead}>
                    <span className={styles.face} aria-hidden="true">
                      <ChatTeardropDots weight="fill" width={18} height={18} />
                    </span>
                    <span className={styles.headText}>
                      <b>Where to?</b>
                      <span>Pick a section and I&apos;ll take you there.</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      aria-label="Close"
                      className={styles.close}
                    >
                      <X width={16} height={16} />
                    </button>
                  </div>
                  <nav className={styles.sheetList}>{list}</nav>
                </div>
              </>
            )}

            <button
              ref={fabRef}
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "Close sections" : title}
              aria-expanded={open}
              className={styles.fab}
            >
              <ArrowUp width={22} height={22} />
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}

/**
 * The links themselves, shared by the card and the sheet so there is one
 * indentation rule and one active style rather than two that drift.
 */
function OutlineList({
  headings,
  minLevel,
  activeId,
  onPick,
}: {
  headings: Heading[];
  minLevel: number;
  activeId: string | null;
  onPick: (h: Heading) => void;
}) {
  return (
    <>
      {headings.map((h) => {
        const active = h.id === activeId;
        return (
          <button
            key={h.id}
            type="button"
            onClick={() => onPick(h)}
            aria-current={active ? "location" : undefined}
            title={h.text}
            className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors cursor-pointer truncate ${
              active
                ? "bg-(--j-purple) text-white font-medium"
                : "text-gray-700 hover:bg-gray-100"
            }`}
            style={{ paddingLeft: `${12 + (h.level - minLevel) * 14}px` }}
          >
            {h.text}
          </button>
        );
      })}
    </>
  );
}
