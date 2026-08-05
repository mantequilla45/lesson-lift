"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/app/lib/auth/client";
import { COST, ONBOARD_FEE, seatRate } from "@/app/lib/costs";
import { fmtDate, fmtRelative, gbp, gbpFromUsd, nf } from "../format";
import {
  AiChip,
  Btn,
  C,
  CheckItem,
  DL,
  Drawer,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  EmptyState,
  Field,
  Meter,
  Modal,
  Note,
  Row,
  Section,
  StatusTag,
  Tag,
  fieldClass,
  fieldStyle,
  useToast,
} from "../ui";
import { SeatLegend, SeatPool } from "./SeatPool";

interface SchoolDetail {
  id: string;
  name: string;
  urn: string | null;
  town: string | null;
  phase: string | null;
  trust_name: string | null;
  status: string;
  seats: number;
  seats_assigned: number;
  seats_invited: number;
  seats_dormant: number;
  seats_free: number;
  rate: number;
  monthly_value: number;
  billing_type: string;
  po_number: string | null;
  finance_email: string | null;
  payment_terms: number;
  invoice_schedule: string;
  vat_registered: boolean;
  contract_start: string | null;
  renews_at: string | null;
  contract_months: number;
  onboarding_fee: number;
  dpa_signed_at: string | null;
  domain_allowlist: string | null;
  resources_per_seat: number;
  ai_images_per_seat: number;
  resources_used: number;
  ai_used: number;
  cost_usd: number;
  contact_name: string | null;
  contact_role: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  created_at: string;
}

interface StaffRow {
  user_id: string | null;
  email: string | null;
  first_name: string | null;
  surname: string | null;
  seat_status: string;
  invited_email: string | null;
  last_active: string | null;
  resources_used: number;
  ai_used: number;
}

interface TaskRow {
  key: string;
  label: string;
  done: boolean;
  done_at: string | null;
  sort: number;
}

export default function SchoolDrawer({
  schoolId,
  onClose,
}: {
  schoolId: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<SchoolDetail | null>(null);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<null | "seats" | "invite">(null);
  const [toastNode, fire] = useToast();

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: d, error: dErr }, { data: s }, { data: t }] = await Promise.all([
      supabase.rpc("admin_school_detail", { sid: schoolId }),
      supabase.rpc("admin_school_staff", { sid: schoolId }),
      supabase.rpc("admin_school_tasks", { sid: schoolId }),
    ]);
    if (dErr || !d || d.length === 0) {
      setError("Could not load this school.");
      return;
    }
    setDetail(d[0] as SchoolDetail);
    setStaff((s ?? []) as StaffRow[]);
    setTasks((t ?? []) as TaskRow[]);
  }, [schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleTask = async (key: string, done: boolean) => {
    const supabase = createClient();
    const { error: e } = await supabase.rpc("admin_set_school_task", {
      sid: schoolId,
      p_key: key,
      p_done: done,
    });
    if (e) {
      fire(e.message);
      return;
    }
    void load();
  };

  const assigned = Number(detail?.seats_assigned ?? 0);
  const dormant = Number(detail?.seats_dormant ?? 0);
  const invited = Number(detail?.seats_invited ?? 0);
  const free = Number(detail?.seats_free ?? 0);

  // Contribution: seat revenue less real logged AI cost less per-active-teacher
  // overheads. No card fee — schools pay by BACS.
  const monthly = Number(detail?.monthly_value ?? 0);
  const aiCost = Number(detail?.cost_usd ?? 0);
  const activeSeats = assigned + dormant;
  const overheads = activeSeats * (COST.infra + COST.support);

  return (
    <Drawer onClose={onClose} width="max-w-xl">
      {(close: () => void) => (
        <>
          {!detail && !error ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm" style={{ color: C.muted }}>
                Loading…
              </p>
            </div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6">
              <p className="text-sm" style={{ color: C.danger }}>
                {error}
              </p>
              <Btn onClick={close}>Close</Btn>
            </div>
          ) : (
            <>
              <DrawerHeader
                title={detail!.name}
                sub={
                  [detail!.town, detail!.urn && `URN ${detail!.urn}`, detail!.trust_name]
                    .filter(Boolean)
                    .join(" · ") || undefined
                }
                tags={
                  <>
                    <StatusTag status={detail!.status} />
                    <Tag tone="brand">
                      {nf.format(detail!.seats)} seats @ {gbp(Number(detail!.rate))}
                    </Tag>
                  </>
                }
                onClose={close}
              />

              <DrawerBody>
                {free === detail!.seats && detail!.seats > 0 && (
                  <Note tone="warn">
                    <b>Nobody has been invited yet.</b> This school has paid for{" "}
                    {nf.format(detail!.seats)} seats and isn&apos;t using any of them.
                  </Note>
                )}

                <Section title="Seat pool">
                  <div
                    className="rounded-xl border p-3.5"
                    style={{ borderColor: C.border, backgroundColor: C.white }}
                  >
                    <div className="mb-3">
                      <SeatPool
                        assigned={assigned}
                        invited={invited}
                        dormant={dormant}
                        free={free}
                      />
                    </div>
                    <div className="flex flex-wrap gap-5 mb-3">
                      {[
                        ["Bought", detail!.seats, C.ink],
                        ["Assigned", assigned, C.ink],
                        ["Invited", invited, C.ink],
                        ["Free", free, free > 0 ? C.warn : C.ink],
                        ["Dormant 30d", dormant, dormant > 0 ? C.warn : C.ink],
                      ].map(([label, value, color]) => (
                        <div key={label as string}>
                          <div className="text-[11px]" style={{ color: C.muted }}>
                            {label}
                          </div>
                          <div
                            className="font-bold tabular-nums"
                            style={{ color: color as string }}
                          >
                            {nf.format(Number(value))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <SeatLegend />
                    <div className="flex flex-wrap gap-2 mt-3">
                      <Btn size="sm" variant="primary" onClick={() => setModal("invite")}>
                        Invite teachers
                      </Btn>
                      <Btn size="sm" onClick={() => setModal("seats")}>
                        Change seat count
                      </Btn>
                    </div>
                  </div>
                </Section>

                <Section title="Pools this month">
                  <div className="text-xs font-semibold mb-1.5" style={{ color: C.ink }}>
                    Resources — {nf.format(detail!.resources_per_seat)} per seat
                  </div>
                  <Meter
                    used={Number(detail!.resources_used)}
                    allow={detail!.seats * detail!.resources_per_seat}
                  />
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs font-semibold" style={{ color: C.ink }}>
                      AI-image slideshows — {detail!.ai_images_per_seat} per seat, pooled
                    </span>
                    <AiChip
                      used={Number(detail!.ai_used)}
                      allow={detail!.seats * detail!.ai_images_per_seat}
                    />
                  </div>
                  <p className="text-xs mt-2" style={{ color: C.muted }}>
                    Neither pool rolls over, but both are <b>shared across the school</b> — a{" "}
                    {nf.format(detail!.seats)}-seat school has{" "}
                    {nf.format(detail!.seats * detail!.resources_per_seat)} resources and{" "}
                    {nf.format(detail!.seats * detail!.ai_images_per_seat)} AI slideshows to
                    distribute as it likes. That flexibility is why a school plan beats
                    individual accounts.
                  </p>
                </Section>

                <Section title="What this school is worth">
                  <div
                    className="rounded-xl border overflow-hidden"
                    style={{ borderColor: C.border, backgroundColor: C.white }}
                  >
                    <table className="w-full text-sm">
                      <tbody>
                        <tr className="border-b" style={{ borderColor: C.divider }}>
                          <td className="px-3.5 py-2" style={{ color: C.ink2 }}>
                            {nf.format(detail!.seats)} seats × {gbp(Number(detail!.rate))}
                          </td>
                          <td
                            className="px-3.5 py-2 text-right tabular-nums"
                            style={{ color: C.ink }}
                          >
                            {gbp(monthly)} / mo
                          </td>
                        </tr>
                        <tr className="border-b" style={{ borderColor: C.divider }}>
                          <td className="px-3.5 py-2" style={{ color: C.ink2 }}>
                            Annual invoice
                          </td>
                          <td
                            className="px-3.5 py-2 text-right tabular-nums"
                            style={{ color: C.ink }}
                          >
                            {gbp(monthly * 12)}
                          </td>
                        </tr>
                        <tr className="border-b" style={{ borderColor: C.divider }}>
                          <td className="px-3.5 py-2" style={{ color: C.ink2 }}>
                            AI cost this month (measured)
                          </td>
                          <td
                            className="px-3.5 py-2 text-right tabular-nums"
                            style={{ color: C.ink2 }}
                          >
                            −{gbpFromUsd(aiCost)}
                          </td>
                        </tr>
                        <tr className="border-b" style={{ borderColor: C.divider }}>
                          <td className="px-3.5 py-2" style={{ color: C.ink2 }}>
                            Hosting and support, {nf.format(activeSeats)} active
                          </td>
                          <td
                            className="px-3.5 py-2 text-right tabular-nums"
                            style={{ color: C.ink2 }}
                          >
                            −{gbp(overheads)}
                          </td>
                        </tr>
                        <tr style={{ backgroundColor: C.surface }}>
                          <td className="px-3.5 py-2 font-bold" style={{ color: C.ink }}>
                            Contribution
                          </td>
                          <td
                            className="px-3.5 py-2 text-right tabular-nums font-bold"
                            style={{ color: C.ink }}
                          >
                            {gbp(monthly - aiCost * 0.79 - overheads)} / mo
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs mt-2" style={{ color: C.muted }}>
                    No card fees — schools pay by BACS, worth about{" "}
                    {gbp(monthly * COST.cardPct)} a month.
                  </p>
                </Section>

                <Section title="Contact & contract">
                  <DL>
                    <Row
                      label="Main contact"
                      value={
                        detail!.contact_name ? (
                          <>
                            {detail!.contact_name}
                            {detail!.contact_role && ` · ${detail!.contact_role}`}
                            {detail!.contact_email && (
                              <div className="font-mono text-xs" style={{ color: C.muted }}>
                                {detail!.contact_email}
                              </div>
                            )}
                          </>
                        ) : (
                          "—"
                        )
                      }
                    />
                    <Row label="Phone" value={detail!.contact_phone ?? "—"} />
                    <Row label="Started" value={fmtDate(detail!.contract_start)} />
                    <Row label="Renews" value={fmtDate(detail!.renews_at)} />
                    <Row
                      label="Billing"
                      value={
                        detail!.billing_type === "invoice"
                          ? "Purchase order / BACS"
                          : detail!.billing_type === "card"
                            ? "Card"
                            : "Direct debit"
                      }
                    />
                    <Row
                      label="PO number"
                      value={
                        detail!.po_number ? (
                          <span className="font-mono text-xs">{detail!.po_number}</span>
                        ) : (
                          <Tag tone="warn">Awaiting</Tag>
                        )
                      }
                    />
                    <Row label="Payment terms" value={`${detail!.payment_terms} days`} />
                    <Row
                      label="Onboarding fee"
                      value={
                        detail!.status === "pending"
                          ? `${gbp(Number(detail!.onboarding_fee ?? ONBOARD_FEE))} — on this invoice`
                          : "Paid"
                      }
                    />
                    <Row
                      label="Domain allow-list"
                      value={
                        detail!.domain_allowlist ? (
                          <span className="font-mono text-xs">{detail!.domain_allowlist}</span>
                        ) : (
                          "—"
                        )
                      }
                    />
                    <Row
                      label="DPA signed"
                      value={
                        detail!.dpa_signed_at ? (
                          <Tag tone="ok">Yes · {fmtDate(detail!.dpa_signed_at)}</Tag>
                        ) : (
                          <Tag tone="warn">Awaiting signature</Tag>
                        )
                      }
                    />
                  </DL>
                </Section>

                <Section title={`Teachers on this plan (${staff.length})`}>
                  {staff.length === 0 ? (
                    <p className="text-sm" style={{ color: C.muted }}>
                      Nobody has been invited yet.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {staff.map((t, i) => {
                        const label =
                          [t.first_name, t.surname].filter(Boolean).join(" ") ||
                          t.email ||
                          t.invited_email ||
                          "—";
                        return (
                          <div
                            key={t.user_id ?? `invited-${i}`}
                            className="flex items-center gap-2.5 py-2 border-b last:border-b-0"
                            style={{ borderColor: C.divider }}
                          >
                            <div className="flex-1 min-w-0">
                              <div
                                className="text-sm font-medium truncate"
                                style={{ color: C.ink }}
                              >
                                {label}
                              </div>
                              <div className="text-xs" style={{ color: C.muted }}>
                                {t.seat_status === "invited"
                                  ? "Invited, not accepted"
                                  : `Last active ${fmtRelative(t.last_active)}`}
                              </div>
                            </div>
                            <StatusTag status={t.seat_status} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Section>

                <Section title="Onboarding checklist">
                  {tasks.length === 0 ? (
                    <EmptyState title="No checklist" body="This school predates the checklist." />
                  ) : (
                    <div>
                      {tasks.map((t) => (
                        <button
                          key={t.key}
                          type="button"
                          className="w-full text-left"
                          onClick={() => toggleTask(t.key, !t.done)}
                        >
                          <CheckItem label={t.label} done={t.done} />
                        </button>
                      ))}
                    </div>
                  )}
                </Section>
              </DrawerBody>

              <DrawerFooter>
                <Btn size="sm" onClick={() => fire("Invoicing arrives with the billing phase.")}>
                  Create invoice
                </Btn>
                <div className="flex-1" />
                <Btn
                  size="sm"
                  variant="danger"
                  onClick={() => fire("Pausing access isn't wired up yet.")}
                >
                  Pause access
                </Btn>
              </DrawerFooter>
            </>
          )}

          {modal === "seats" && detail && (
            <SeatModal
              school={detail}
              onClose={() => setModal(null)}
              onSaved={(msg) => {
                fire(msg);
                void load();
              }}
            />
          )}
          {modal === "invite" && detail && (
            <InviteModal
              school={detail}
              onClose={() => setModal(null)}
              onSaved={(msg) => {
                fire(msg);
                void load();
              }}
            />
          )}
          {toastNode}
        </>
      )}
    </Drawer>
  );
}

// ── Change seat count ────────────────────────────────────────────────────────
function SeatModal({
  school,
  onClose,
  onSaved,
}: {
  school: SchoolDetail;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [seats, setSeats] = useState(school.seats);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Previewed client-side from the mirrored band table; the server recomputes
  // it authoritatively on save.
  const rate = seatRate(seats);
  const crossesBand = rate !== Number(school.rate);

  const submit = async () => {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: e } = await supabase.rpc("admin_update_seats", {
      sid: school.id,
      n: seats,
    });
    setSaving(false);
    if (e) {
      setError(e.message);
      return;
    }
    onSaved(`Seat count updated to ${seats}.`);
    onClose();
  };

  return (
    <Modal
      title={`Change seats for ${school.name}`}
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={submit} disabled={saving || seats < 10}>
            {saving ? "Saving…" : "Save seats"}
          </Btn>
        </>
      }
    >
      <Field label="Seats (minimum 10)">
        <input
          type="number"
          min={10}
          value={seats}
          onChange={(e) => setSeats(Number(e.target.value))}
          className={fieldClass}
          style={fieldStyle}
        />
      </Field>

      <Note tone={crossesBand ? "warn" : "brand"}>
        <b>
          {nf.format(seats)} seats at {gbp(rate)} = {gbp(seats * rate)} a month
        </b>
        , {gbp(seats * rate * 12)} a year. Pools:{" "}
        {nf.format(seats * school.resources_per_seat)} resources and{" "}
        {nf.format(seats * school.ai_images_per_seat)} AI slideshows a month.
        {crossesBand && (
          <>
            {" "}
            This crosses a band boundary — the rate moves from {gbp(Number(school.rate))} to{" "}
            {gbp(rate)} on <b>every</b> seat, not just the new ones.
          </>
        )}
      </Note>

      <p className="text-xs mt-3" style={{ color: C.muted }}>
        Adding seats generates a prorated invoice to the renewal date. Seats can only be
        removed if they&apos;re unassigned — reclaim a teacher&apos;s seat first.
      </p>

      {error && (
        <p className="text-sm mt-2" style={{ color: C.danger }}>
          {error}
        </p>
      )}
    </Modal>
  );
}

// ── Invite teachers ──────────────────────────────────────────────────────────
function InviteModal({
  school,
  onClose,
  onSaved,
}: {
  school: SchoolDetail;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emails = text
    .split(/[\n,;]+/)
    .map((e) => e.trim())
    .filter(Boolean);
  const free = Number(school.seats_free);

  const submit = async () => {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data, error: e } = await supabase.rpc("admin_invite_teachers", {
      sid: school.id,
      emails,
    });
    setSaving(false);
    if (e) {
      setError(e.message);
      return;
    }
    const sent = Number(data ?? 0);
    onSaved(
      sent === emails.length
        ? `${sent} invite${sent === 1 ? "" : "s"} sent.`
        : `${sent} of ${emails.length} invited — the rest were duplicates, malformed, or you ran out of seats.`,
    );
    onClose();
  };

  return (
    <Modal
      title={`Invite teachers to ${school.name}`}
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={submit} disabled={saving || emails.length === 0}>
            {saving ? "Sending…" : `Invite ${emails.length || ""}`.trim()}
          </Btn>
        </>
      }
    >
      <Field
        label="Email addresses"
        help="One per line, or a comma-separated list. Duplicates and malformed addresses are skipped."
      >
        <textarea
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`teacher@${school.domain_allowlist ?? "school.sch.uk"}`}
          className={`${fieldClass} resize-none`}
          style={fieldStyle}
        />
      </Field>

      {emails.length > free ? (
        <Note tone="warn">
          {nf.format(emails.length)} addresses but only <b>{nf.format(free)}</b> free seat
          {free === 1 ? "" : "s"}. The first {nf.format(free)} will be invited — add seats to
          invite the rest.
        </Note>
      ) : (
        <Note>
          {nf.format(free)} free seat{free === 1 ? "" : "s"} available.
        </Note>
      )}

      {error && (
        <p className="text-sm mt-2" style={{ color: C.danger }}>
          {error}
        </p>
      )}
    </Modal>
  );
}
