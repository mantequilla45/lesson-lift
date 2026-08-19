// Loading shapes for the Usage & Billing tabs.
//
// Local rather than imported from app/admin/ui.tsx: that module is the admin
// console's design system and pulling it into a teacher page would create a
// dependency from teacher UI onto admin UI, which is exactly the direction that
// should never exist. The house convention (animate-pulse with #EEECE4 fill) is
// small enough to restate.
//
// Shapes must match the real content's dimensions — a skeleton that's the wrong
// height just moves the layout shift to a different moment.

function Bone({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`rounded ${className ?? ""}`}
      style={{ backgroundColor: "#EEECE4", ...style }}
    />
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-6 border animate-pulse"
      style={{ backgroundColor: "#FAF9F5", borderColor: "#DAD8D0" }}
    >
      {children}
    </div>
  );
}

/** Plan card + allowance meter, in the narrow column Overview actually uses. */
export function OverviewSkeleton() {
  return (
    <div className="max-w-xl space-y-5">
      <Card>
        <div className="flex items-start justify-between mb-4">
          <div>
            <Bone className="h-3 w-20 mb-2" />
            <Bone className="h-6 w-28" />
          </div>
          <Bone className="h-6 w-16 rounded-full" />
        </div>
        <Bone className="h-4 w-48 mb-5" />
        <div className="flex flex-wrap gap-2">
          <Bone className="h-10 w-36 rounded-xl" />
          <Bone className="h-10 w-32 rounded-xl" />
        </div>
      </Card>

      <Card>
        <Bone className="h-3 w-28 mb-2" />
        <Bone className="h-6 w-40 mb-4" />
        <Bone className="h-2 w-full rounded-full mb-3" />
        <Bone className="h-4 w-56" />
      </Card>
    </div>
  );
}

/** A table shell. `cols` drives the header row so widths stay plausible. */
export function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div
      className="rounded-2xl border overflow-hidden animate-pulse"
      style={{ backgroundColor: "#FAF9F5", borderColor: "#DAD8D0" }}
    >
      <div className="px-4 py-3 flex gap-4 border-b" style={{ borderColor: "#EEECE4" }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Bone key={i} className={`h-4 ${i === 0 ? "w-32" : "grow"}`} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="px-4 py-3 flex gap-4 border-t"
          style={{ borderColor: "#EEECE4" }}
        >
          {Array.from({ length: cols }).map((_, i) => (
            <Bone key={i} className={`h-4 ${i === 0 ? "w-32" : "grow"}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Dispatcher so the page's single Suspense boundary can show the shape of the
 * tab actually being loaded, rather than one generic blob for all three.
 */
export function TabSkeleton({ tab }: { tab: "overview" | "usage" | "history" }) {
  if (tab === "overview") return <OverviewSkeleton />;
  if (tab === "history") return <TableSkeleton rows={4} cols={5} />;
  return <TableSkeleton rows={5} cols={6} />;
}
