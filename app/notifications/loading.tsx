import AppShell from "@/app/components/layout/AppShell";

export default function Loading() {
  return (
    <AppShell
      title="Notifications"
      banner={false}
      launcher={false}
      contentClassName="px-4 sm:px-6 lg:px-10 pb-16 space-y-3 animate-pulse"
    >
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="h-20 rounded-2xl" style={{ backgroundColor: "#EEECE4" }} />
      ))}
    </AppShell>
  );
}
