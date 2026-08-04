import { requireAdmin } from "@/app/lib/auth/admin";
import ComingSoon from "../ComingSoon";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  await requireAdmin();
  return <ComingSoon title="Audit log" blurb="Every admin action, permanently." />;
}
