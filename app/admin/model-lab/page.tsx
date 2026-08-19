import { requireAdmin } from "@/app/lib/auth/admin";
import ModelLabView from "./ModelLabView";

export const dynamic = "force-dynamic";

export default async function AdminModelLabPage() {
  // The real boundary is server-side in labModelFor(), which re-checks
  // is_admin before honouring any model override. This is the UX gate.
  await requireAdmin();
  return <ModelLabView />;
}
