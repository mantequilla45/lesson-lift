import { requireAdmin } from "@/app/lib/auth/admin";
import OnboardWizard, { type TrustOption } from "./OnboardWizard";

export const dynamic = "force-dynamic";

export default async function AdminOnboardPage() {
  const { supabase } = await requireAdmin();
  const { data: trusts } = await supabase.rpc("admin_trusts");

  return <OnboardWizard trusts={(trusts ?? []) as TrustOption[]} />;
}
