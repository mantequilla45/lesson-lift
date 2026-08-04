import { requireAdmin } from "@/app/lib/auth/admin";
import ComingSoon from "../ComingSoon";

export const dynamic = "force-dynamic";

export default async function AdminEmailsPage() {
  await requireAdmin();
  return <ComingSoon title="Email templates" blurb="Every automatic email Jooma sends." />;
}
