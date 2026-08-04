import { requireAdmin } from "@/app/lib/auth/admin";
import ComingSoon from "../ComingSoon";

export const dynamic = "force-dynamic";

export default async function AdminAnnouncePage() {
  await requireAdmin();
  return <ComingSoon title="Announcements" blurb="Banners inside the teacher dashboard." />;
}
