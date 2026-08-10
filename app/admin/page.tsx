import { requireAdmin } from "@/app/lib/auth/admin";
import DashboardView, {
  type CostRow,
  type DashboardStats,
  type NeedsAttentionRow,
  type SignupRow,
} from "./DashboardView";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const { supabase } = await requireAdmin();

  const [{ data: stats }, { data: attention }, { data: signups }, { data: costs }] =
    await Promise.all([
      supabase.rpc("admin_dashboard"),
      supabase.rpc("admin_needs_attention"),
      supabase.rpc("admin_signups_by_month", { months: 6 }),
      supabase.rpc("admin_cost_breakdown"),
    ]);

  return (
    <DashboardView
      stats={((stats ?? [])[0] ?? null) as DashboardStats | null}
      attention={(attention ?? []) as NeedsAttentionRow[]}
      signups={(signups ?? []) as SignupRow[]}
      costs={(costs ?? []) as CostRow[]}
    />
  );
}
