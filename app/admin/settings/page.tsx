import { requireAdmin } from "@/app/lib/auth/admin";
import SettingsView, { type SettingRow } from "./SettingsView";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.rpc("admin_settings");

  return <SettingsView rows={(data ?? []) as SettingRow[]} />;
}
