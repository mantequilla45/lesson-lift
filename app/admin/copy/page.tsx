import { requireAdmin } from "@/app/lib/auth/admin";
import CopyView, { type CopyBlock } from "./CopyView";

export const dynamic = "force-dynamic";

export default async function AdminCopyPage() {
  const { supabase } = await requireAdmin();

  const [{ data: blocks }, { data: can }] = await Promise.all([
    supabase.rpc("admin_copy_blocks"),
    supabase.rpc("admin_can", { p_permission: "edit_copy" }),
  ]);

  return <CopyView rows={(blocks ?? []) as CopyBlock[]} canEdit={can === true} />;
}
