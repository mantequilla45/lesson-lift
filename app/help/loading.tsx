import AppShell from "@/app/components/layout/AppShell";

// /help is force-dynamic with a blocking RPC, so without this the whole route
// segment stalls on navigation. Dimensions mirror HelpView's grid so the real
// content lands without a layout shift — including the responsive collapse to
// a single column below `lg`, which must match or /help flashes a desktop grid
// on every mobile navigation.
export default function Loading() {
  return (
    <AppShell
      title="Help"
      variant="fixed"
      banner={false}
      launcher={false}
      contentClassName="px-4 sm:px-6 lg:px-10 pb-4 sm:pb-10 grow min-h-0"
    >
      <div
        /* min-h-0 below lg — the desktop 440px floor would overflow a short
           phone, and the height calc already sizes it. */
        className="rounded-3xl border overflow-hidden grid animate-pulse
          grid-cols-1 lg:grid-cols-[minmax(240px,320px)_minmax(0,1fr)]
          h-[calc(100dvh-9rem)] lg:h-[calc(100dvh-190px)] min-h-0 lg:min-h-110"
        style={{ backgroundColor: "#FAF9F5", borderColor: "#DAD8D0" }}
      >
        <div className="lg:border-r p-3 space-y-3" style={{ borderColor: "#DAD8D0" }}>
          <div className="h-10 rounded-2xl" style={{ backgroundColor: "#EEECE4" }} />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2 px-1 py-2">
              <div className="h-3.5 w-2/3 rounded" style={{ backgroundColor: "#EEECE4" }} />
              <div className="h-3 w-full rounded" style={{ backgroundColor: "#EEECE4" }} />
              <div className="h-3 w-1/3 rounded" style={{ backgroundColor: "#EEECE4" }} />
            </div>
          ))}
        </div>
        {/* The detail pane is hidden below `lg`, matching HelpView: on a phone
            the list and the conversation are alternate views, not columns. */}
        <div className="hidden lg:block p-6 space-y-3">
          <div className="h-4 w-1/3 rounded" style={{ backgroundColor: "#EEECE4" }} />
          <div className="h-3 w-1/4 rounded" style={{ backgroundColor: "#EEECE4" }} />
        </div>
      </div>
    </AppShell>
  );
}
