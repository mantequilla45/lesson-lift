import { Skeleton } from "../ui";

// The inbox is a three-pane layout rather than a table, so it gets its own
// skeleton instead of the shared PageSkeleton.
export default function Loading() {
  return (
    <>
      <div className="mb-6">
        <Skeleton className="h-7 w-32 mb-2" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div
        className="grid gap-px rounded-2xl overflow-hidden"
        style={{
          gridTemplateColumns: "minmax(250px, 300px) minmax(0, 1fr) minmax(240px, 290px)",
          height: "calc(100vh - 190px)",
          minHeight: 460,
        }}
      >
        <Skeleton className="h-full" />
        <Skeleton className="h-full" />
        <Skeleton className="h-full" />
      </div>
    </>
  );
}
