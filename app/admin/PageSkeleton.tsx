import { Skeleton } from "./ui";

// Shared loading skeleton for admin pages. Every admin page is force-dynamic
// with a blocking RPC, so without a loading.tsx the whole route segment stalls
// on navigation. This gives the shell something to paint immediately while the
// server component streams in.
export default function PageSkeleton({
  stats = 0,
  rows = 6,
}: {
  /** Number of stat tiles above the table, if the page has them. */
  stats?: number;
  /** Number of placeholder table rows. */
  rows?: number;
}) {
  return (
    <>
      <div className="mb-6">
        <Skeleton className="h-7 w-48 mb-2" />
        <Skeleton className="h-4 w-80" />
      </div>

      {stats > 0 && (
        <div className="grid gap-3.5 mb-6" style={{ gridTemplateColumns: `repeat(${Math.min(stats, 4)}, minmax(0, 1fr))` }}>
          {Array.from({ length: stats }).map((_, i) => (
            <Skeleton key={i} className="h-[104px] rounded-2xl" />
          ))}
        </div>
      )}

      <Skeleton className="h-12 rounded-t-2xl" />
      <div className="space-y-px">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
      <Skeleton className="h-10 rounded-b-2xl" />
    </>
  );
}
