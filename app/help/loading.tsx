import SideNav from "@/app/components/layout/SideNav";
import TopBar from "@/app/components/layout/TopBar";

// /help is force-dynamic with a blocking RPC, so without this the whole route
// segment stalls on navigation. Dimensions mirror HelpView's grid so the real
// content lands without a layout shift.
export default function Loading() {
  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "#F1EFE3" }}>
      <SideNav />
      <main className="grow flex flex-col min-h-screen min-w-0">
        <TopBar title="Help" />
        <div className="px-10 pb-10 grow min-h-0">
          <div
            className="rounded-3xl border overflow-hidden grid animate-pulse"
            style={{
              backgroundColor: "#FAF9F5",
              borderColor: "#DAD8D0",
              gridTemplateColumns: "minmax(240px, 320px) minmax(0, 1fr)",
              height: "calc(100vh - 190px)",
              minHeight: 440,
            }}
          >
            <div className="border-r p-3 space-y-3" style={{ borderColor: "#DAD8D0" }}>
              <div className="h-10 rounded-2xl" style={{ backgroundColor: "#EEECE4" }} />
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-2 px-1 py-2">
                  <div className="h-3.5 w-2/3 rounded" style={{ backgroundColor: "#EEECE4" }} />
                  <div className="h-3 w-full rounded" style={{ backgroundColor: "#EEECE4" }} />
                  <div className="h-3 w-1/3 rounded" style={{ backgroundColor: "#EEECE4" }} />
                </div>
              ))}
            </div>
            <div className="p-6 space-y-3">
              <div className="h-4 w-1/3 rounded" style={{ backgroundColor: "#EEECE4" }} />
              <div className="h-3 w-1/4 rounded" style={{ backgroundColor: "#EEECE4" }} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
