import { requireAdmin } from "@/app/lib/auth/admin";
import ComingSoon from "../ComingSoon";

export const dynamic = "force-dynamic";

export default async function AdminOnboardPage() {
  await requireAdmin();
  return <ComingSoon title="Onboard a school" blurb="Step-by-step wizard for setting up a new school account." />;
}
