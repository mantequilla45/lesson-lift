import { requireAdmin } from "@/app/lib/auth/admin";
import ComingSoon from "../ComingSoon";

export const dynamic = "force-dynamic";

export default async function AdminTeamPage() {
  await requireAdmin();
  return <ComingSoon title="Team & roles" blurb="Who on your side can see what." />;
}
