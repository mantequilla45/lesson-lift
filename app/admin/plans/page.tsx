import { requireAdmin } from "@/app/lib/auth/admin";
import ComingSoon from "../ComingSoon";

export const dynamic = "force-dynamic";

export default async function AdminPlansPage() {
  await requireAdmin();
  return <ComingSoon title="Plans & pricing" blurb="What each plan costs, what it includes, and what it leaves you." />;
}
