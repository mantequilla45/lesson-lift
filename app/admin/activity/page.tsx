import { requireAdmin } from "@/app/lib/auth/admin";
import ActivityView, { type RunRow } from "./ActivityView";

export const dynamic = "force-dynamic";

export default async function AdminActivityPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.rpc("admin_recent_runs", { lim: 100 });

  return <ActivityView rows={(data ?? []) as RunRow[]} />;
}
