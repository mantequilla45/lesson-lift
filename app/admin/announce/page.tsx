import { requireAdmin } from "@/app/lib/auth/admin";
import AnnounceView, { type AnnouncementRow } from "./AnnounceView";

export const dynamic = "force-dynamic";

export default async function AdminAnnouncePage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.rpc("admin_announcements");

  return <AnnounceView rows={(data ?? []) as AnnouncementRow[]} />;
}
