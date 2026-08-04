import { requireAdmin } from "@/app/lib/auth/admin";
import ComingSoon from "../ComingSoon";

export const dynamic = "force-dynamic";

export default async function AdminInboxPage() {
  await requireAdmin();
  return <ComingSoon title="Inbox" blurb="Support conversations with teachers and schools." />;
}
