import AppShellV2 from "@/app/components/v2/AppShellV2";
import { PersonalInfoSkeleton } from "./Skeletons";
import { SECTIONS } from "./sections-shared";

// Route-entry skeleton. The page is force-dynamic, so arriving here always costs
// a server round trip; without this the segment shows nothing at all while that
// resolves — and a dynamic route with no loading.tsx also can't be usefully
// prefetched by <Link>. See docs/instant-navigation-guide.md §4.
//
// Personal info is the default section, so its shape is the right thing to show
// for a cold arrival. Landing directly on ?section=password briefly shows this
// instead; the alternative is reading searchParams here, which loading.tsx
// cannot do.
export default function Loading() {
  return (
    <AppShellV2 title="Profile" contentClassName="px-4 sm:px-6 lg:px-10 pb-16">
      <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)] items-start">
        {/* Settings menu placeholder — same rhythm as the real links, so the
            column doesn't jump when they land. */}
        <div className="flex lg:flex-col gap-1 animate-pulse">
          {SECTIONS.map(({ id, label }) => (
            <div
              key={id}
              className="h-10 rounded-2xl shrink-0"
              style={{ backgroundColor: "var(--j-tint)", width: `${label.length * 7 + 32}px` }}
            />
          ))}
        </div>
        <div className="min-w-0">
          <PersonalInfoSkeleton />
        </div>
      </div>
    </AppShellV2>
  );
}
