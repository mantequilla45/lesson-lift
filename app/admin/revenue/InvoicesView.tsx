"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/auth/client";
import { fmtDate, gbp, nf } from "../format";
import {
  Btn,
  C,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  FilterBar,
  Modal,
  Note,
  PageHead,
  Stat,
  StatusTag,
  Table,
  Tag,
  Td,
  Th,
  Tr,
  fieldClass,
  fieldStyle,
  inputClass,
  inputStyle,
  useToast,
} from "../ui";

export interface InvoiceRow {
  id: string;
  reference: string;
  payer: string;
  type: string;
  amount_gbp: number;
  status: string;
  due_at: string | null;
  paid_at: string | null;
  method: string | null;
  po_number: string | null;
  attempt_count: number;
  failure_reason: string | null;
  school_id: string | null;
  user_id: string | null;
  created_at: string;
}

export interface BillingSummary {
  collected_this_month: number;
  outstanding: number;
  overdue_count: number;
  failed_count: number;
  failed_value: number;
  refunded_this_month: number;
}

export interface SchoolOption {
  id: string;
  name: string;
  seats: number;
  annual_value: number;
}

/** A subscription Stripe is currently failing to collect on. */
export interface DunningRow {
  id: string;
  userId: string | null;
  email: string | null;
  status: string;
  amountGbp: number;
  nextAttempt: string | null;
  since: string;
}

export default function InvoicesView({
  rows,
  summary,
  schools,
  dunning,
  stripeError,
}: {
  rows: InvoiceRow[];
  summary: BillingSummary | null;
  schools: SchoolOption[];
  dunning: DunningRow[];
  stripeError: string | null;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [raising, setRaising] = useState(false);
  const [portalBusy, setPortalBusy] = useState<string | null>(null);
  const [toastNode, fire] = useToast();

  /**
   * Mint a billing-portal link for a teacher whose card is failing, for the
   * admin to send on. Reuses the existing admin route, which logs the action —
   * the link is a bearer credential, so it is copied deliberately rather than
   * emailed automatically.
   */
  const copyPortalLink = async (userId: string | null, label: string) => {
    if (!userId) {
      fire("No Jooma account is linked to that Stripe customer.");
      return;
    }
    setPortalBusy(userId);
    try {
      const res = await fetch("/api/admin/teachers/billing-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const json = await res.json();
      if (!res.ok) {
        fire(json.error ?? "Could not create a portal link.");
        return;
      }
      await navigator.clipboard.writeText(json.url);
      fire(`Portal link for ${label} copied.`);
    } catch {
      fire("Could not create a portal link.");
    } finally {
      setPortalBusy(null);
    }
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((i) => {
      if (needle) {
        const hay = `${i.reference} ${i.payer} ${i.amount_gbp}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (status && i.status !== status) return false;
      if (type && i.type !== type) return false;
      return true;
    });
  }, [rows, q, status, type]);

  const needsAction = rows.filter((i) => i.status === "failed" || i.status === "overdue");

  const setInvoiceStatus = async (id: string, next: string, ref: string) => {
    const supabase = createClient();
    const { error } = await supabase.rpc("admin_set_invoice_status", {
      inv_id: id,
      p_status: next,
    });
    if (error) {
      fire(error.message);
      return;
    }
    fire(`${ref} marked ${next}.`);
    router.refresh();
  };

  return (
    <>
      <PageHead
        title="Payments & invoices"
        sub="Card charges from teachers and BACS invoices from schools, in one list."
      >
        {/* School invoices are the only kind raised by hand, and the School
            plan isn't built — so with no schools on file there is nothing this
            can be pointed at. Say why rather than showing a dead button. */}
        <span
          title={
            schools.length === 0
              ? "Not available — invoices are raised against a school, and the School plan isn't built yet"
              : undefined
          }
        >
          <Btn variant="primary" onClick={() => setRaising(true)} disabled={schools.length === 0}>
            + Raise invoice
          </Btn>
        </span>
      </PageHead>

      <div className="grid gap-3.5 mb-6 grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Collected this month"
          value={gbp(Number(summary?.collected_this_month ?? 0))}
          foot="Paid invoices, this calendar month"
        />
        <Stat
          label="Outstanding"
          value={gbp(Number(summary?.outstanding ?? 0))}
          foot={`${nf.format(Number(summary?.overdue_count ?? 0))} overdue`}
        />
        <Stat
          label="Failed payments"
          value={nf.format(Number(summary?.failed_count ?? 0))}
          foot={`${gbp(Number(summary?.failed_value ?? 0))} at risk`}
        />
        <Stat
          label="Refunded"
          value={gbp(Number(summary?.refunded_this_month ?? 0))}
          foot="this month"
        />
      </div>

      {needsAction.length > 0 && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Failed and overdue — act on these</CardTitle>
            <Tag tone="danger">{nf.format(needsAction.length)}</Tag>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              {needsAction.map((i) => (
                <div key={i.id} className="flex flex-wrap items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold" style={{ color: C.ink }}>
                      {i.payer}
                    </span>
                    <span style={{ color: C.ink2 }}>
                      {" "}
                      · {i.reference} · {gbp(Number(i.amount_gbp))}
                    </span>
                    <div className="text-xs" style={{ color: C.muted }}>
                      {i.status === "failed"
                        ? `${i.failure_reason ?? "Payment failed"}${
                            i.attempt_count ? ` · attempt ${i.attempt_count}` : ""
                          }`
                        : `Due ${fmtDate(i.due_at)}${i.po_number ? ` · ${i.po_number}` : ""}`}
                    </div>
                  </div>
                  <Btn size="sm" onClick={() => setInvoiceStatus(i.id, "paid", i.reference)}>
                    Mark paid
                  </Btn>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <FilterBar>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Invoice number, name or amount"
            className={inputClass}
            style={{ ...inputStyle, minWidth: 230 }}
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={inputClass}
            style={inputStyle}
          >
            <option value="">Any status</option>
            {["draft", "sent", "paid", "overdue", "failed", "refunded", "void"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className={inputClass}
            style={inputStyle}
          >
            <option value="">All types</option>
            <option value="school">School invoice</option>
            <option value="card">Card charge</option>
            <option value="topup">Top-up</option>
          </select>
          <div className="flex-1" />
          <Tag>{nf.format(filtered.length)} shown</Tag>
        </FilterBar>

        {filtered.length === 0 ? (
          <EmptyState
            title={rows.length === 0 ? "No invoices yet" : "Nothing matches that"}
            body={
              rows.length === 0
                ? "Card charges appear here automatically once Stripe sends its first invoice event. School invoices are raised manually."
                : "Try clearing a filter."
            }
          />
        ) : (
          <Table>
            <thead>
              <tr className="text-left">
                <Th>Reference</Th>
                <Th>Who</Th>
                <Th>Method</Th>
                <Th align="right">Amount</Th>
                <Th>Due</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => (
                <Tr key={i.id}>
                  <Td>
                    <span className="font-mono text-xs" style={{ color: C.ink }}>
                      {i.reference}
                    </span>
                  </Td>
                  <Td>
                    <span className="font-medium" style={{ color: C.ink }}>
                      {i.payer}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-xs" style={{ color: C.ink2 }}>
                      {i.method ?? "—"}
                    </span>
                  </Td>
                  <Td align="right" mono>
                    {gbp(Number(i.amount_gbp))}
                  </Td>
                  <Td>
                    <span className="text-xs">{fmtDate(i.due_at)}</span>
                  </Td>
                  <Td>
                    <StatusTag status={i.status} />
                  </Td>
                  <Td align="right">
                    {i.status !== "paid" && i.status !== "void" && (
                      <Btn size="sm" onClick={() => setInvoiceStatus(i.id, "paid", i.reference)}>
                        Mark paid
                      </Btn>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <div className="grid gap-3.5 mt-4 lg:grid-cols-2">
        {/* Cards Stripe is currently failing to collect on, read live. Retries
            are Stripe's Smart Retries, configured in its dashboard — this shows
            who is affected right now rather than describing a schedule. */}
        <Card>
          <CardHeader>
            <CardTitle>Failing payments</CardTitle>
          </CardHeader>
          {stripeError ? (
            <CardBody>
              <Note tone="danger">
                <b>Could not reach Stripe.</b> {stripeError}
              </Note>
            </CardBody>
          ) : dunning.length === 0 ? (
            <EmptyState
              title="No failing payments"
              body="Nobody's card is currently being retried."
            />
          ) : (
            <Table>
              <thead>
                <tr className="text-left">
                  <Th>Teacher</Th>
                  <Th align="right">Amount</Th>
                  <Th>State</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {dunning.map((d) => (
                  <Tr key={d.id}>
                    <Td>
                      <span style={{ color: C.ink }}>{d.email ?? "Unknown"}</span>
                    </Td>
                    <Td align="right" mono>
                      {gbp(d.amountGbp)}
                    </Td>
                    <Td>
                      <StatusTag status={d.status} />
                    </Td>
                    <Td align="right">
                      <Btn
                        size="sm"
                        disabled={portalBusy === d.userId || !d.userId}
                        onClick={() => copyPortalLink(d.userId, d.email ?? "this teacher")}
                      >
                        Copy card-update link
                      </Btn>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
          <CardFooter>
            Retry timing is Stripe&apos;s, set in its billing settings.{" "}
            <b>past due</b> means it is still retrying; <b>unpaid</b> means it has given up.
            The card-update link is a private credential — send it to the teacher directly.
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tax &amp; company</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="text-sm space-y-1.5">
              {[
                ["Currency", "GBP only"],
                ["Invoice prefix", "INV-" + new Date().getFullYear() + "-"],
                ["Payment terms", "30 days default"],
                [
                  "Stripe",
                  // Derived from whether this page's Stripe call actually
                  // answered, rather than an unconditional "Connected".
                  stripeError ? "Unreachable" : "Connected · invoice events mirrored locally",
                ],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <span style={{ color: C.muted }}>{k}</span>
                  <span
                    className="text-right"
                    style={{ color: k === "Stripe" && stripeError ? C.danger : C.ink }}
                  >
                    {v}
                  </span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      {raising && (
        <RaiseInvoiceModal
          schools={schools}
          onClose={() => setRaising(false)}
          onCreated={(msg) => {
            fire(msg);
            router.refresh();
          }}
        />
      )}
      {toastNode}
    </>
  );
}

function RaiseInvoiceModal({
  schools,
  onClose,
  onCreated,
}: {
  schools: SchoolOption[];
  onClose: () => void;
  onCreated: (msg: string) => void;
}) {
  const [schoolId, setSchoolId] = useState(schools[0]?.id ?? "");
  const [amount, setAmount] = useState<string>("");
  const [dueAt, setDueAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const school = schools.find((s) => s.id === schoolId);
  const suggested = Number(school?.annual_value ?? 0);

  const submit = async () => {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: e } = await supabase.rpc("admin_create_invoice", {
      p_school_id: schoolId,
      p_amount: amount ? Number(amount) : null,
      p_due_at: dueAt || null,
      p_method: null,
    });
    setSaving(false);
    if (e) {
      setError(e.message);
      return;
    }
    onCreated("Invoice drafted.");
    onClose();
  };

  return (
    <Modal
      title="Raise a school invoice"
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={submit} disabled={saving || !schoolId}>
            {saving ? "Creating…" : "Create draft"}
          </Btn>
        </>
      }
    >
      <Field label="School">
        <select
          value={schoolId}
          onChange={(e) => setSchoolId(e.target.value)}
          className={fieldClass}
          style={fieldStyle}
        >
          {schools.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({nf.format(s.seats)} seats)
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Amount (£)"
        help={
          suggested > 0
            ? `Leave blank to use a full year at the banded rate: ${gbp(suggested)}.`
            : "Leave blank to use a full year at the banded rate."
        }
      >
        <input
          type="number"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={suggested > 0 ? String(suggested) : ""}
          className={fieldClass}
          style={fieldStyle}
        />
      </Field>

      <Field label="Due date" help="Leave blank to use the school's payment terms.">
        <input
          type="date"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
          className={fieldClass}
          style={fieldStyle}
        />
      </Field>

      <Note>
        Created as a <b>draft</b> with a reference allocated server-side. It doesn&apos;t send
        anything — mark it sent once your finance process has actually issued it.
      </Note>

      {error && (
        <p className="text-sm mt-2" style={{ color: C.danger }}>
          {error}
        </p>
      )}
    </Modal>
  );
}