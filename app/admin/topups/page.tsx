import { requireAdmin } from "@/app/lib/auth/admin";
import ComingSoon from "../ComingSoon";

export const dynamic = "force-dynamic";

export default async function AdminTopupsPage() {
  await requireAdmin();
  return <ComingSoon title="Top-ups" blurb="What a teacher can buy when they run out mid-month." />;
}
