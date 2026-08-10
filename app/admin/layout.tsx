import { requireAdmin } from "@/app/lib/auth/admin";
import AdminSidebar from "./AdminSidebar";

// Gates the whole /admin subtree on the is_admin flag and renders the sidenav
// shell. Non-admins are redirected by requireAdmin before any child page runs.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { supabase } = await requireAdmin();

  // Live nav counts. Kept to things that represent work waiting on someone —
  // an inbox badge means "reply to these", not "here are some tickets".
  // Failures are swallowed: a missing count must never take down the shell.
  const badges: Record<string, number> = {};
  const { data: support } = await supabase.rpc("admin_support_summary");
  const open = Number(support?.[0]?.open_count ?? 0);
  if (open > 0) badges["/admin/inbox"] = open;

  const { data: flags } = await supabase.rpc("admin_safeguarding_summary");
  const awaiting = Number(flags?.[0]?.awaiting_review ?? 0);
  if (awaiting > 0) badges["/admin/flags"] = awaiting;

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: "#F1EFE3" }}>
      <AdminSidebar badges={badges} />
      <main className="flex-1 min-w-0 px-8 py-10">
        <div className="w-full">{children}</div>
      </main>
    </div>
  );
}
