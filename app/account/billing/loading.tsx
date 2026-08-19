import { OverviewSkeleton } from "./Skeletons";

// Route-entry skeleton. The page is force-dynamic, so arriving here always costs
// a server round-trip; without this the segment shows nothing at all while that
// resolves — and a dynamic route with no loading.tsx also can't be usefully
// prefetched by <Link>. See docs/instant-navigation-guide.md §4.
//
// Shapes mirror the real chrome (same max widths, same card heights) so the
// content lands without a shift. Overview is the default tab, so its shape is
// the right thing to show for a cold arrival.
export default function Loading() {
  return (
    <div className="min-h-screen py-12 px-4" style={{ backgroundColor: "#F1EFE3" }}>
      <div className="max-w-5xl mx-auto w-full animate-pulse">
        <div className="h-5 w-16 rounded mb-6" style={{ backgroundColor: "#EEECE4" }} />
        <div className="h-8 w-56 rounded mb-2" style={{ backgroundColor: "#EEECE4" }} />
        <div className="h-4 w-72 rounded mb-6" style={{ backgroundColor: "#EEECE4" }} />

        {/* Tab strip placeholder — same height and radius as the real one, so it
            doesn't jump when the interactive version replaces it. */}
        <div
          className="inline-flex gap-1 p-1 rounded-2xl border mb-6"
          style={{ backgroundColor: "#FAF9F5", borderColor: "#DAD8D0" }}
        >
          {["Overview", "Usage", "History"].map((label) => (
            <div
              key={label}
              className="h-9 rounded-xl"
              style={{ backgroundColor: "#EEECE4", width: `${label.length * 9 + 32}px` }}
            />
          ))}
        </div>

        <OverviewSkeleton />
      </div>
    </div>
  );
}
