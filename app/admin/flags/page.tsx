import { requireAdmin } from "@/app/lib/auth/admin";
import ComingSoon from "../ComingSoon";

export const dynamic = "force-dynamic";

export default async function AdminFlagsPage() {
  await requireAdmin();
  return <ComingSoon title="Safeguarding flags" blurb="Generations the filter caught, awaiting review." />;
}
