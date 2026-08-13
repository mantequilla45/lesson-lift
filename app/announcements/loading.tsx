import SideNav from "@/app/components/layout/SideNav";
import TopBar from "@/app/components/layout/TopBar";

export default function Loading() {
  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "#F1EFE3" }}>
      <SideNav />
      <main className="grow flex flex-col overflow-y-auto">
        <TopBar title="Announcements" />
        <div className="px-10 pb-16 space-y-3 animate-pulse">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-20 rounded-2xl" style={{ backgroundColor: "#EEECE4" }} />
          ))}
        </div>
      </main>
    </div>
  );
}
