import { requireAdmin } from "@/app/lib/auth/admin";
import EmailsView, { type EmailTemplate } from "./EmailsView";

export const dynamic = "force-dynamic";

export default async function AdminEmailsPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.rpc("admin_email_templates");

  return <EmailsView rows={(data ?? []) as EmailTemplate[]} />;
}
