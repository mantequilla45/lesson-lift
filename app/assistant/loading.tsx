import SideNav from "@/app/components/layout/SideNav";
import TopBar from "@/app/components/layout/TopBar";

// Shapes mirror AssistantView's two columns so the real content lands without a
// layout shift. Same reasoning as app/dashboard/loading.tsx.
export default function Loading() {
  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "#F1EFE3" }}>
      <SideNav />
      <main className="grow flex flex-col overflow-hidden h-screen">
        <TopBar title="AI assistant" />
        <div className="flex flex-1 gap-3 overflow-hidden px-10 pb-5">
          <div
            className="w-[292px] shrink-0 rounded-2xl p-6 animate-pulse"
            style={{ backgroundColor: "#FAF9F5" }}
          >
            <div className="h-7 w-32 rounded mb-5" style={{ backgroundColor: "#EEECE4" }} />
            <div className="h-11 w-full rounded-xl mb-5" style={{ backgroundColor: "#EEECE4" }} />
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 rounded-xl" style={{ backgroundColor: "#EEECE4" }} />
              ))}
            </div>
          </div>
          <div
            className="flex-1 rounded-2xl animate-pulse"
            style={{ backgroundColor: "#FAF9F5" }}
          />
        </div>
      </main>
    </div>
  );
}
