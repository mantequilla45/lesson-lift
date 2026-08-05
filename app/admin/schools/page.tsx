import { requireAdmin } from "@/app/lib/auth/admin";
import SchoolsTable, { type SchoolRow, type TrustRow } from "./SchoolsTable";

export const dynamic = "force-dynamic";

export default async function AdminSchoolsPage() {
  const { supabase } = await requireAdmin();

  const [{ data: schools }, { data: trusts }] = await Promise.all([
    supabase.rpc("admin_schools"),
    supabase.rpc("admin_trusts"),
  ]);

  return (
    <SchoolsTable
      rows={(schools ?? []) as SchoolRow[]}
      trusts={(trusts ?? []) as TrustRow[]}
    />
  );
}
