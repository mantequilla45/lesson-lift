import { requireAdmin } from "@/app/lib/auth/admin";
import InvoicesView, { type BillingSummary, type InvoiceRow, type SchoolOption } from "./InvoicesView";

export const dynamic = "force-dynamic";

export default async function AdminRevenuePage() {
  const { supabase } = await requireAdmin();

  const [{ data: invoices }, { data: summary }, { data: schools }] = await Promise.all([
    supabase.rpc("admin_invoices"),
    supabase.rpc("admin_billing_summary"),
    supabase.rpc("admin_schools"),
  ]);

  return (
    <InvoicesView
      rows={(invoices ?? []) as InvoiceRow[]}
      summary={((summary ?? [])[0] ?? null) as BillingSummary | null}
      schools={((schools ?? []) as SchoolOption[]).map((s) => ({
        id: s.id,
        name: s.name,
        seats: s.seats,
        annual_value: s.annual_value,
      }))}
    />
  );
}
