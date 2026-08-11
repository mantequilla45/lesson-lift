import { requireAdmin } from "@/app/lib/auth/admin";
import InboxView, { type CannedReply, type SupportSummary, type ThreadRow } from "./InboxView";

export const dynamic = "force-dynamic";

export default async function AdminInboxPage() {
  const { supabase, user } = await requireAdmin();

  const [{ data: threads }, { data: canned }, { data: summary }] = await Promise.all([
    supabase.rpc("admin_threads", { p_status: null, p_filter: null, q: null }),
    supabase.rpc("admin_canned_replies"),
    supabase.rpc("admin_support_summary"),
  ]);

  return (
    <InboxView
      initialThreads={(threads ?? []) as ThreadRow[]}
      canned={(canned ?? []) as CannedReply[]}
      summary={((summary ?? [])[0] ?? null) as SupportSummary | null}
      currentUserId={user.id}
    />
  );
}
