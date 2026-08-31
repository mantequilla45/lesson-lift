/**
 * The strip that hides content scrolling behind a tool's sticky result header.
 *
 * ResultPanel's own header is `sticky top-0 lg:top-8`, which leaves an 8px gap
 * above it on desktop. Without something opaque filling that gap, the page
 * content scrolls through it. This is that filler, so its background MUST track
 * the page background or the seam reappears.
 *
 * It was the same line copy-pasted into 32 of the 35 tool forms, each with the
 * page background written out as a literal. That is exactly the "duplicate
 * rules drift" trap in the developer handover: one of them was always going to
 * be missed on a rebrand. One component now, one edit next time.
 *
 * `h-0` below `lg` because the header is not offset there, so there is no gap
 * to fill. The negative margins bleed it to the gutter edges, matching the
 * page's `px-4 sm:px-6 lg:px-10` rhythm.
 */
export default function StickyMask() {
  return (
    <div
      className="sticky top-0 z-20 h-0 lg:h-8 -mx-4 sm:-mx-6 lg:-mx-10"
      style={{ backgroundColor: "var(--j-bg)" }}
      aria-hidden="true"
    />
  );
}
