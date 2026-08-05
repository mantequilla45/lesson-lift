import { requireAdmin } from "@/app/lib/auth/admin";
import PromosView, { type PromoRow } from "./PromosView";

export const dynamic = "force-dynamic";

export default async function AdminPromosPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.rpc("admin_promo_codes");

  return <PromosView rows={(data ?? []) as PromoRow[]} />;
}
