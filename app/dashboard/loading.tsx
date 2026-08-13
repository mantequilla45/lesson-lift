import SideNav from "@/app/components/layout/SideNav";
import TopBar from "@/app/components/layout/TopBar";

// The dashboard became an async server component when it started reading
// editable copy, so navigation now has a server round-trip to cover. Without
// this the route segment shows nothing at all while that resolves. Shapes
// mirror DashboardView so the real content lands without a layout shift.
export default function Loading() {
  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "#F1EFE3" }}>
      <SideNav />
      <main className="grow flex flex-col overflow-y-auto">
        <TopBar title="Dashboard" />
        <div className="px-10 pb-16 space-y-4">
          <div
            className="rounded-3xl border p-10 animate-pulse"
            style={{ backgroundColor: "#FAF9F5", borderColor: "#DAD8D0" }}
          >
            <div className="h-7 w-64 rounded mb-2" style={{ backgroundColor: "#EEECE4" }} />
            <div className="h-4 w-80 rounded mb-6" style={{ backgroundColor: "#EEECE4" }} />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-24 rounded-2xl"
                  style={{ backgroundColor: "#EEECE4" }}
                />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
