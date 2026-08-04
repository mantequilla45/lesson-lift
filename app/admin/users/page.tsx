import { requireAdmin } from "@/app/lib/auth/admin";
import { nf } from "../format";
import AdminTeachersTable, { type TeacherRow } from "./AdminTeachersTable";
import AdminTeachersHeaderActions from "./AdminTeachersHeaderActions";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.rpc("admin_users");
  const rows = (data ?? []) as TeacherRow[];

  return (
    <>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: "#1a1a1a" }}>
            Teachers
          </h1>
          <p className="text-sm" style={{ color: "#8a8078" }}>
            {nf.format(rows.length)} {rows.length === 1 ? "teacher" : "teachers"}. Resources reset
            monthly; AI images have no cap yet.
          </p>
        </div>
        <AdminTeachersHeaderActions />
      </div>

      <AdminTeachersTable rows={rows} />
    </>
  );
}
