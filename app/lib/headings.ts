// Heading extraction and anchor ids, shared by MarkdownResult (which renders
// the ids) and OutputOutline (which links to them).
//
// Both derive from the SAME markdown source, which is the point. The four
// hardcoded navs this replaces — LessonPlannerNav, EYFSNav, WorksheetNav,
// SensoryActivitiesNav — each held a literal list of expected section names and
// found them by querySelectorAll("h2") + textContent string matching. That
// broke in two ways teachers actually hit: the model phrasing a heading
// differently from the hardcoded list, and the teacher editing a heading in the
// Tiptap editor after generation. Parsing the source fixes both, and covers all
// 32 markdown tools rather than 4.

export interface Heading {
  /** 1, 2 or 3 — from #, ## or ###. */
  level: number;
  /** Heading text, with inline markdown stripped. */
  text: string;
  /** Anchor id, unique within one document. */
  id: string;
  /** 0-based position among ALL headings, in document order. This is what makes
   *  the outline survive an edit: ids come off the original markdown, but the
   *  Tiptap editor renders its own DOM with no ids at all, so the outline falls
   *  back to "the nth heading" — which text edits cannot break. */
  index: number;
}

/** Inline markdown a heading might carry, removed so "**Section 1**" and
 *  "Section 1" produce the same label and the same id. */
function stripInline(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

/** URL-safe id from heading text. Collisions are resolved by the caller. */
export function slugify(text: string): string {
  const base = stripInline(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
  // A heading of only punctuation or non-Latin script would slug to "", which
  // is not a usable id.
  return base || "section";
}

/**
 * Every `#`/`##`/`###` heading in a markdown document, in order.
 *
 * MUST stay in lockstep with MarkdownResult's own line walk, which assigns the
 * ids: it matches `line.startsWith("# ")` on every line and does NOT track code
 * fences, so neither does this. Skipping fenced blocks here would look tidier
 * but would shift every subsequent id by one — the outline would then link each
 * heading to its neighbour, which is worse than an occasional stray entry from
 * a code comment. (In practice these tools emit prose, not code.)
 *
 * Duplicate slugs get a numeric suffix ("assessment", "assessment-2"), because
 * repeated headings are common in these documents — several "Activities"
 * sections in a scheme of work, for instance — and getElementById would
 * otherwise always find the first.
 */
export function extractHeadings(markdown: string): Heading[] {
  const headings: Heading[] = [];
  const seen = new Map<string, number>();

  for (const line of markdown.split("\n")) {
    // Anchored, no leading whitespace, exactly as MarkdownResult tests it.
    const match = /^(#{1,3})\s+(.*)$/.exec(line);
    if (!match) continue;

    // `\s+` matches MarkdownResult's `startsWith("## ")` exactly: both treat a
    // bare "##" as a paragraph and "## " (trailing space) as an empty heading.
    // That empty heading still RENDERS as an <h2> there, so it must consume an
    // index here too, or every id after it shifts by one. It is filtered out of
    // the visible list in OutputOutline instead of being dropped here.
    const text = stripInline(match[2]);

    const base = slugify(text);
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);

    headings.push({
      level: match[1].length,
      text,
      id: count === 1 ? base : `${base}-${count}`,
      index: headings.length,
    });
  }

  return headings;
}

/**
 * The id MarkdownResult should render for a heading at a given position.
 *
 * MarkdownResult walks the same lines in the same order, so passing the running
 * heading count keeps the two in lockstep without re-parsing the document.
 */
export function headingIdAt(headings: Heading[], index: number): string | undefined {
  return headings[index]?.id;
}
