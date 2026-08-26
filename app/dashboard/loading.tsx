import AppShell from "@/app/components/layout/AppShell";

// The dashboard became an async server component when it started reading
// editable copy, so navigation now has a server round-trip to cover. Without
// this the route segment shows nothing at all while that resolves. Shapes
// mirror DashboardView so the real content lands without a layout shift.
export default function Loading() {
  return (
    <AppShell title="Dashboard" launcher={false} banner={false}>
      <div
        className="rounded-3xl border p-5 sm:p-6 lg:p-8 animate-pulse"
        style={{ backgroundColor: "#FAF9F5", borderColor: "#DAD8D0" }}
      >
        {/* Widths cap at the viewport so the skeleton does not overflow a phone
            before the real content has even arrived. */}
        <div className="h-7 w-full max-w-64 rounded mb-2" style={{ backgroundColor: "#EEECE4" }} />
        <div className="h-4 w-full max-w-80 rounded mb-6" style={{ backgroundColor: "#EEECE4" }} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl" style={{ backgroundColor: "#EEECE4" }} />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
