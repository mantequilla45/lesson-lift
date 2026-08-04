import { requireAdmin } from "@/app/lib/auth/admin";
import ComingSoon from "../ComingSoon";

export const dynamic = "force-dynamic";

export default async function AdminToolsPage() {
  await requireAdmin();
  return <ComingSoon title="Tools" blurb="Turn a tool off, change who gets it, or move it to a cheaper model." />;
}
