import { requireAdmin } from "@/app/lib/auth/admin";
import ComingSoon from "../ComingSoon";

export const dynamic = "force-dynamic";

export default async function AdminCopyPage() {
  await requireAdmin();
  return <ComingSoon title="Website & app copy" blurb="Every bit of text on jooma.ai and in the teacher dashboard." />;
}
