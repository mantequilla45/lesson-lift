import { requireAdmin } from "@/app/lib/auth/admin";
import ComingSoon from "../ComingSoon";

export const dynamic = "force-dynamic";

export default async function AdminSchoolsPage() {
  await requireAdmin();
  return <ComingSoon title="Schools" blurb="Seat pools, invoices and onboarding progress for every institution." />;
}
