import { Skeleton } from "../ui";

// Two panes rather than a table, so it gets its own skeleton instead of the
// shared PageSkeleton. The grid template and height match EnquiriesView exactly,
// or the layout jumps as the real content arrives.
export default function Loading() {
  return (
    <>
      <div className="mb-6">
        <Skeleton className="h-7 w-36 mb-2" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div
        className="grid gap-px rounded-2xl overflow-hidden"
        style={{
          gridTemplateColumns: "minmax(260px, 320px) minmax(0, 1fr)",
          height: "calc(100vh - 260px)",
          minHeight: 460,
        }}
      >
        <Skeleton className="h-full" />
        <Skeleton className="h-full" />
      </div>
    </>
  );
}
