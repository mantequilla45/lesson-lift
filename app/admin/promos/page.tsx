import { requireAdmin } from "@/app/lib/auth/admin";
import ComingSoon from "../ComingSoon";

export const dynamic = "force-dynamic";

export default async function AdminPromosPage() {
  await requireAdmin();
  return <ComingSoon title="Promo codes" blurb="For campaigns, conferences and win-backs." />;
}
