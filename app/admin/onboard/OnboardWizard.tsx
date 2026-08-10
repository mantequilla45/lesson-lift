"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/app/lib/auth/client";
import { COST, MIN_SEATS, ONBOARD_FEE, SEAT_BANDS, seatRate } from "@/app/lib/costs";
import { gbp, nf, pence } from "../format";
import {
  Btn,
  C,
  Card,
  CardBody,
  Field,
  Note,
  PageHead,
  Stepper,
  Table,
  Td,
  Th,
  Toggle,
  ToggleRow,
  Tr,
  fieldClass,
  fieldStyle,
} from "../ui";

export interface TrustOption {
  id: string;
  name: string;
  schools: number;
}

const STEPS = [
  "School details",
  "Plan & seats",
  "Billing",
  "Admin contact",
  "Invite teachers",
  "Go live",
];

interface Draft {
  name: string;
  urn: string;
  phase: string;
  town: string;
  trust_name: string;
  seats: number;
  contract_months: number;
  resources_per_seat: number;
  ai_images_per_seat: number;
  onboarding_fee: number;
  billing_type: string;
  po_number: string;
  payment_terms: number;
  finance_email: string;
  invoice_schedule: string;
  vat_registered: boolean;
  access_before_payment: boolean;
  contact_name: string;
  contact_role: string;
  contact_email: string;
  contact_phone: string;
  can_invite: boolean;
  can_move_capacity: boolean;
  can_view_reports: boolean;
  can_buy_seats: boolean;
  domain_allowlist: string;
  invite_emails: string;
  renews_at: string;
}

const BLANK: Draft = {
  name: "",
  urn: "",
  phase: "primary",
  town: "",
  trust_name: "",
  seats: 14,
  contract_months: 12,
  resources_per_seat: 300,
  ai_images_per_seat: 3,
  onboarding_fee: ONBOARD_FEE,
  billing_type: "invoice",
  po_number: "",
  payment_terms: 30,
  finance_email: "",
  invoice_schedule: "annual",
  vat_registered: false,
  access_before_payment: true,
  contact_name: "",
  contact_role: "",
  contact_email: "",
  contact_phone: "",
  can_invite: true,
  can_move_capacity: true,
  can_view_reports: true,
  can_buy_seats: false,
  domain_allowlist: "",
  invite_emails: "",
  renews_at: "",
};

export default function OnboardWizard({ trusts }: { trusts: TrustOption[] }) {
  const router = useRouter();
  const params = useSearchParams();

  // Step lives in the URL so back/forward and refresh behave. The draft itself
  // stays in memory — it's a single sitting, and putting a contact's phone
  // number in the query string would be worse than losing it on refresh.
  const step = Math.min(Math.max(Number(params.get("step") ?? 1), 1), STEPS.length);
  const [d, setD] = useState<Draft>(BLANK);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setD((prev) => ({ ...prev, [key]: value }));

  const goto = (n: number) => {
    const q = new URLSearchParams(params.toString());
    q.set("step", String(n));
    router.push(`/admin/onboard?${q}`, { scroll: false });
  };

  const rate = seatRate(d.seats);
  const annual = d.seats * rate * 12;

  const create = async () => {
    setSaving(true);
    setError(null);
    const supabase = createClient();

    const { data: newId, error: e } = await supabase.rpc("admin_create_school", {
      payload: {
        name: d.name,
        urn: d.urn,
        town: d.town,
        phase: d.phase,
        trust_name: d.trust_name,
        seats: d.seats,
        billing_type: d.billing_type,
        po_number: d.po_number,
        finance_email: d.finance_email,
        payment_terms: d.payment_terms,
        invoice_schedule: d.invoice_schedule,
        vat_registered: d.vat_registered,
        access_before_payment: d.access_before_payment,
        contract_months: d.contract_months,
        onboarding_fee: d.onboarding_fee,
        domain_allowlist: d.domain_allowlist,
        resources_per_seat: d.resources_per_seat,
        ai_images_per_seat: d.ai_images_per_seat,
        contact_name: d.contact_name,
        contact_role: d.contact_role,
        contact_email: d.contact_email,
        contact_phone: d.contact_phone,
        renews_at: d.renews_at,
      },
    });

    if (e) {
      setSaving(false);
      setError(e.message);
      return;
    }

    // Invites are a separate call so a bad address can't roll back the school.
    const emails = d.invite_emails
      .split(/[\n,;]+/)
      .map((x) => x.trim())
      .filter(Boolean);
    if (emails.length > 0 && newId) {
      await supabase.rpc("admin_invite_teachers", { sid: newId, emails });
    }

    setSaving(false);
    router.push("/admin/schools");
  };

  const canContinue = step !== 1 || d.name.trim().length > 0;

  return (
    <div className="max-w-3xl">
      <PageHead
        title="Onboard a school"
        sub="Six steps. Nothing is created until the last one."
      />

      <Stepper steps={STEPS} current={step} />

      <Card>
        <CardBody>
          {step === 1 && (
            <div className="grid gap-x-4 sm:grid-cols-2">
              <Field label="School name">
                <input
                  value={d.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="e.g. Ashcombe Primary"
                  className={fieldClass}
                  style={fieldStyle}
                />
              </Field>
              <Field label="URN" help="The DfE Unique Reference Number, if you have it.">
                <input
                  value={d.urn}
                  onChange={(e) => set("urn", e.target.value)}
                  placeholder="6 digits"
                  className={fieldClass}
                  style={fieldStyle}
                />
              </Field>
              <Field label="Phase">
                <select
                  value={d.phase}
                  onChange={(e) => set("phase", e.target.value)}
                  className={fieldClass}
                  style={fieldStyle}
                >
                  <option value="primary">Primary</option>
                  <option value="secondary">Secondary</option>
                  <option value="all-through">All-through</option>
                  <option value="special">Special / AP</option>
                </select>
              </Field>
              <Field label="Town">
                <input
                  value={d.town}
                  onChange={(e) => set("town", e.target.value)}
                  className={fieldClass}
                  style={fieldStyle}
                />
              </Field>
              <Field label="Trust" help="Leave blank for a standalone school.">
                <input
                  value={d.trust_name}
                  onChange={(e) => set("trust_name", e.target.value)}
                  list="trust-options"
                  placeholder="Standalone"
                  className={fieldClass}
                  style={fieldStyle}
                />
                <datalist id="trust-options">
                  {trusts.map((t) => (
                    <option key={t.id} value={t.name} />
                  ))}
                </datalist>
              </Field>
            </div>
          )}

          {step === 2 && (
            <>
              <div className="grid gap-x-4 sm:grid-cols-2">
                <Field label={`Seats (minimum ${MIN_SEATS})`}>
                  <input
                    type="number"
                    min={MIN_SEATS}
                    value={d.seats}
                    onChange={(e) => set("seats", Number(e.target.value))}
                    className={fieldClass}
                    style={fieldStyle}
                  />
                </Field>
                <Field label="Contract length">
                  <select
                    value={d.contract_months}
                    onChange={(e) => set("contract_months", Number(e.target.value))}
                    className={fieldClass}
                    style={fieldStyle}
                  >
                    <option value={12}>12 months, aligned to academic year</option>
                    <option value={24}>24 months (onboarding fee waived)</option>
                    <option value={4}>Term only (pilot)</option>
                  </select>
                </Field>
                <Field label="Resources per seat / month">
                  <input
                    type="number"
                    value={d.resources_per_seat}
                    onChange={(e) => set("resources_per_seat", Number(e.target.value))}
                    className={fieldClass}
                    style={fieldStyle}
                  />
                </Field>
                <Field
                  label="AI-image slideshows per seat / month"
                  help={`Each costs about ${pence(COST.deckAI)}. Raise it and the seat margin falls fast.`}
                >
                  <input
                    type="number"
                    value={d.ai_images_per_seat}
                    onChange={(e) => set("ai_images_per_seat", Number(e.target.value))}
                    className={fieldClass}
                    style={fieldStyle}
                  />
                </Field>
              </div>

              {d.seats < MIN_SEATS ? (
                <Note tone="warn">
                  <b>Minimum is {MIN_SEATS} seats.</b> Below that, individual Pro accounts
                  work out better for them and for you.
                </Note>
              ) : (
                <Note>
                  <b>
                    {nf.format(d.seats)} seats × {gbp(rate)} = {gbp(d.seats * rate)} a month
                  </b>{" "}
                  — invoiced annually at <b>{gbp(annual)}</b>, plus{" "}
                  {gbp(d.contract_months >= 24 ? 0 : d.onboarding_fee)} onboarding. Pools:{" "}
                  {nf.format(d.seats * d.resources_per_seat)} resources and{" "}
                  {nf.format(d.seats * d.ai_images_per_seat)} AI slideshows a month.
                  {annual < 1000 && (
                    <div className="mt-1 font-semibold" style={{ color: C.ok }}>
                      Under £1,000 — most heads can approve this without governors.
                    </div>
                  )}
                </Note>
              )}

              <div className="mt-4 rounded-xl border overflow-hidden" style={{ borderColor: C.border }}>
                <Table>
                  <thead>
                    <tr className="text-left">
                      <Th>Band</Th>
                      <Th align="right">Per seat / month</Th>
                      <Th align="right">Per seat / year</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {SEAT_BANDS.map((b) => {
                      const active = d.seats >= b.min && d.seats <= b.max;
                      return (
                        <Tr key={b.band}>
                          <Td>
                            <span style={{ color: active ? C.ink : C.muted, fontWeight: active ? 600 : 400 }}>
                              {b.band} seats {active && "←"}
                            </span>
                          </Td>
                          <Td align="right" mono>
                            {gbp(b.rate)}
                          </Td>
                          <Td align="right" mono>
                            {gbp(b.rate * 12)}
                          </Td>
                        </Tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <Field label="How do they pay?">
                <select
                  value={d.billing_type}
                  onChange={(e) => set("billing_type", e.target.value)}
                  className={fieldClass}
                  style={fieldStyle}
                >
                  <option value="invoice">Invoice / purchase order (most schools)</option>
                  <option value="card">Card</option>
                  <option value="direct_debit">Direct debit</option>
                </select>
              </Field>
              <div className="grid gap-x-4 sm:grid-cols-2">
                <Field label="PO number" help="Leave blank if not issued yet.">
                  <input
                    value={d.po_number}
                    onChange={(e) => set("po_number", e.target.value)}
                    className={fieldClass}
                    style={fieldStyle}
                  />
                </Field>
                <Field label="Payment terms">
                  <select
                    value={d.payment_terms}
                    onChange={(e) => set("payment_terms", Number(e.target.value))}
                    className={fieldClass}
                    style={fieldStyle}
                  >
                    <option value={30}>30 days</option>
                    <option value={60}>60 days</option>
                    <option value={0}>On receipt</option>
                  </select>
                </Field>
                <Field label="Finance email">
                  <input
                    value={d.finance_email}
                    onChange={(e) => set("finance_email", e.target.value)}
                    placeholder="finance@school.sch.uk"
                    className={fieldClass}
                    style={fieldStyle}
                  />
                </Field>
                <Field label="Invoice schedule">
                  <select
                    value={d.invoice_schedule}
                    onChange={(e) => set("invoice_schedule", e.target.value)}
                    className={fieldClass}
                    style={fieldStyle}
                  >
                    <option value="annual">Annually in advance</option>
                    <option value="termly">Termly</option>
                  </select>
                </Field>
              </div>
              <ToggleRow
                title="VAT registered school"
                desc="Adds VAT at 20% and shows the number on the invoice."
              >
                <Toggle on={d.vat_registered} onChange={(v) => set("vat_registered", v)} />
              </ToggleRow>
              <ToggleRow
                title="Give access before payment clears"
                desc="Schools often need to start before finance processes the PO."
              >
                <Toggle
                  on={d.access_before_payment}
                  onChange={(v) => set("access_before_payment", v)}
                />
              </ToggleRow>
            </>
          )}

          {step === 4 && (
            <>
              <p className="text-sm mb-4" style={{ color: C.muted }}>
                The school admin manages their own seats — you shouldn&apos;t have to do it
                for them.
              </p>
              <div className="grid gap-x-4 sm:grid-cols-2">
                <Field label="Name">
                  <input
                    value={d.contact_name}
                    onChange={(e) => set("contact_name", e.target.value)}
                    className={fieldClass}
                    style={fieldStyle}
                  />
                </Field>
                <Field label="Role">
                  <input
                    value={d.contact_role}
                    onChange={(e) => set("contact_role", e.target.value)}
                    placeholder="e.g. Deputy Head"
                    className={fieldClass}
                    style={fieldStyle}
                  />
                </Field>
                <Field label="Email">
                  <input
                    value={d.contact_email}
                    onChange={(e) => set("contact_email", e.target.value)}
                    className={fieldClass}
                    style={fieldStyle}
                  />
                </Field>
                <Field label="Phone">
                  <input
                    value={d.contact_phone}
                    onChange={(e) => set("contact_phone", e.target.value)}
                    className={fieldClass}
                    style={fieldStyle}
                  />
                </Field>
              </div>

              <h3 className="text-sm font-bold mt-4 mb-1" style={{ color: C.ink }}>
                What can the school admin do?
              </h3>
              <ToggleRow title="Invite and remove teachers" desc="Within their seat count.">
                <Toggle on={d.can_invite} onChange={(v) => set("can_invite", v)} />
              </ToggleRow>
              <ToggleRow title="Move capacity between teachers" desc="From the school pool.">
                <Toggle
                  on={d.can_move_capacity}
                  onChange={(v) => set("can_move_capacity", v)}
                />
              </ToggleRow>
              <ToggleRow
                title="See usage reports"
                desc="Who's using it, and how much time it's saving."
              >
                <Toggle on={d.can_view_reports} onChange={(v) => set("can_view_reports", v)} />
              </ToggleRow>
              <ToggleRow
                title="Buy more seats themselves"
                desc="Off by default — most schools need a PO first."
              >
                <Toggle on={d.can_buy_seats} onChange={(v) => set("can_buy_seats", v)} />
              </ToggleRow>

              <Note tone="warn">
                The admin contact is recorded on the school now. Giving them an actual login
                needs an account — invite them on the next step with the same email.
              </Note>
            </>
          )}

          {step === 5 && (
            <>
              <Field
                label="Email domain"
                help="Anyone with this domain can join without an individual invite, up to the seat count."
              >
                <input
                  value={d.domain_allowlist}
                  onChange={(e) => set("domain_allowlist", e.target.value)}
                  placeholder="school.sch.uk"
                  className={fieldClass}
                  style={fieldStyle}
                />
              </Field>
              <Field
                label="Teacher emails"
                help={`One per line. ${nf.format(d.seats)} seats available — extras are skipped.`}
              >
                <textarea
                  rows={6}
                  value={d.invite_emails}
                  onChange={(e) => set("invite_emails", e.target.value)}
                  placeholder="Or skip and let the school admin do it"
                  className={`${fieldClass} resize-none`}
                  style={fieldStyle}
                />
              </Field>
              <Field label="Renewal date" help="Usually aligned to the academic year.">
                <input
                  type="date"
                  value={d.renews_at}
                  onChange={(e) => set("renews_at", e.target.value)}
                  className={fieldClass}
                  style={fieldStyle}
                />
              </Field>
            </>
          )}

          {step === 6 && (
            <>
              <h3 className="text-sm font-bold mb-3" style={{ color: C.ink }}>
                Ready to go live
              </h3>
              <div
                className="rounded-xl border overflow-hidden mb-4"
                style={{ borderColor: C.border, backgroundColor: C.white }}
              >
                <table className="w-full text-sm">
                  <tbody>
                    {[
                      ["School", d.name || "—"],
                      ["Seats", `${nf.format(d.seats)} @ ${gbp(rate)} per seat / month`],
                      ["Annual invoice", gbp(annual)],
                      [
                        "Onboarding fee",
                        d.contract_months >= 24
                          ? "Waived (two-year deal)"
                          : gbp(d.onboarding_fee),
                      ],
                      [
                        "Pools",
                        `${nf.format(d.seats * d.resources_per_seat)} resources · ${nf.format(
                          d.seats * d.ai_images_per_seat,
                        )} AI slideshows`,
                      ],
                      ["Billing", `${d.billing_type} · ${d.payment_terms} day terms`],
                      ["Admin contact", d.contact_name || "Not set"],
                      [
                        "Invites",
                        d.invite_emails.split(/[\n,;]+/).filter((x) => x.trim()).length ||
                          "None yet",
                      ],
                    ].map(([k, v]) => (
                      <tr key={k as string} className="border-b last:border-b-0" style={{ borderColor: C.divider }}>
                        <td className="px-3.5 py-2" style={{ color: C.muted }}>
                          {k}
                        </td>
                        <td className="px-3.5 py-2 text-right" style={{ color: C.ink }}>
                          {v}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Note tone="warn">
                The school is created as <b>Not started</b> with a six-step onboarding
                checklist. Work through it on the school record as the contract, PO and
                training land.
              </Note>

              {error && (
                <p className="text-sm mt-3" style={{ color: C.danger }}>
                  {error}
                </p>
              )}
            </>
          )}
        </CardBody>

        <div
          className="flex items-center gap-2 px-4 py-3 border-t"
          style={{ borderColor: C.divider, backgroundColor: C.surface }}
        >
          <Btn onClick={() => goto(step - 1)} disabled={step === 1}>
            Back
          </Btn>
          <div className="flex-1" />
          {step < STEPS.length ? (
            <Btn variant="primary" onClick={() => goto(step + 1)} disabled={!canContinue}>
              Continue
            </Btn>
          ) : (
            <Btn variant="primary" onClick={create} disabled={saving || !d.name.trim()}>
              {saving ? "Creating…" : "Create school"}
            </Btn>
          )}
        </div>
      </Card>

      {step === 1 && !canContinue && (
        <p className="text-xs mt-2" style={{ color: C.muted }}>
          A school name is required to continue.
        </p>
      )}
    </div>
  );
}
