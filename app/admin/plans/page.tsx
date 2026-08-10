import { requireAdmin } from "@/app/lib/auth/admin";
import PlansView, { type PlanRow, type PricingRule } from "./PlansView";

export const dynamic = "force-dynamic";

export default async function AdminPlansPage() {
  const { supabase } = await requireAdmin();

  const [{ data: plans }, { data: rules }] = await Promise.all([
    supabase.rpc("admin_plans"),
    supabase.rpc("admin_pricing_rules"),
  ]);

  return <PlansView plans={(plans ?? []) as PlanRow[]} rules={(rules ?? []) as PricingRule[]} />;
}
