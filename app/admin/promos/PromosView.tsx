"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fmtDate, nf } from "../format";
import {
  Btn,
  C,
  Card,
  CardFooter,
  EmptyState,
  Field,
  FilterBar,
  Modal,
  Note,
  PageHead,
  Table,
  Tag,
  Td,
  Th,
  Toggle,
  Tr,
  fieldClass,
  fieldStyle,
  inputClass,
  inputStyle,
  useToast,
} from "../ui";

export interface PromoRow {
  id: string;
  code: string;
  offer: string;
  channel: string | null;
  redeemed: number;
  max_redemptions: number | null;
  expires_at: string | null;
  active: boolean;
  duration: string | null;
  applies_to_products: number;
  created_at: string;
}

/**
 * Stripe is the source of truth. Codes are created and deactivated here through
 * the Stripe API rather than mirrored into our database — a code that existed
 * only locally would be rejected the moment a teacher typed it at checkout.
 *
 * WHAT CANNOT BE EDITED: a coupon's discount is immutable in Stripe. Once a code
 * is 20% off it stays 20% off; changing an offer means a new code. So there is
 * no "edit" here, only create and activate/deactivate.
 */
export default function PromosView({
  rows,
  error,
}: {
  rows: PromoRow[];
  error: string | null;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [state, setState] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [toastNode, fire] = useToast();

  const setActive = async (id: string, code: string, next: boolean) => {
    setBusy(id);
    try {
      const res = await fetch("/api/admin/promos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, active: next }),
      });
      const json = await res.json();
      if (!res.ok) {
        fire(json.error ?? "Could not update the code.");
        return;
      }
      fire(`${code} ${next ? "activated" : "deactivated"}.`);
      router.refresh();
    } catch {
      fire("Could not reach Stripe.");
    } finally {
      setBusy(null);
    }
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((p) => {
      if (needle && !`${p.code} ${p.offer} ${p.channel ?? ""}`.toLowerCase().includes(needle)) {
        return false;
      }
      const expired = p.expires_at ? new Date(p.expires_at) < new Date() : false;
      if (state === "active" && (!p.active || expired)) return false;
      if (state === "inactive" && p.active && !expired) return false;
      return true;
    });
  }, [rows, q, state]);

  const totalRedeemed = rows.reduce((a, p) => a + Number(p.redeemed), 0);

  return (
    <>
      <PageHead
        title="Promo codes"
        sub="Every promotion code live in Stripe, with how many times each has been redeemed."
      >
        <Btn variant="primary" onClick={() => setCreating(true)} disabled={!!error}>
          + New code
        </Btn>
      </PageHead>

      {error ? (
        <Note tone="danger">
          <b>Could not reach Stripe.</b> {error}
        </Note>
      ) : (
        <Note>
          Codes live <b>in Stripe</b>, which is what validates them at checkout — this page
          reads and writes them there directly, so there is no second copy to fall out of step.
          A code&apos;s discount can&apos;t be changed once created; to change an offer, make a
          new code and deactivate the old one.
        </Note>
      )}

      <div className="mt-4">
        <Card>
          <FilterBar>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Code, offer or channel"
              className={inputClass}
              style={{ ...inputStyle, minWidth: 230 }}
            />
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className={inputClass}
              style={inputStyle}
            >
              <option value="">Any state</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive or expired</option>
            </select>
            <div className="flex-1" />
            <Tag>{nf.format(filtered.length)} shown</Tag>
          </FilterBar>

          {filtered.length === 0 ? (
            <EmptyState
              title={rows.length === 0 ? "No promotion codes in Stripe" : "Nothing matches that"}
              body={
                rows.length === 0
                  ? "Use + New code to create one in Stripe. Checkout already accepts them — allow_promotion_codes is on."
                  : "Try clearing a filter."
              }
            />
          ) : (
            <Table>
              <thead>
                <tr className="text-left">
                  <Th>Code</Th>
                  <Th>Offer</Th>
                  <Th>Where it&apos;s used</Th>
                  <Th align="right">Redeemed</Th>
                  <Th>Expires</Th>
                  <Th>State</Th>
                  <Th align="right">Active</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const expired = p.expires_at ? new Date(p.expires_at) < new Date() : false;
                  const capped =
                    p.max_redemptions != null && p.redeemed >= p.max_redemptions;
                  return (
                    <Tr key={p.id}>
                      <Td>
                        <span
                          className="font-mono font-semibold text-xs"
                          style={{ color: C.ink }}
                        >
                          {p.code}
                        </span>
                      </Td>
                      <Td>
                        <span style={{ color: C.ink }}>{p.offer}</span>
                        {p.applies_to_products > 0 && (
                          <div className="text-xs" style={{ color: C.muted }}>
                            Limited to {p.applies_to_products} product
                            {p.applies_to_products === 1 ? "" : "s"}
                          </div>
                        )}
                      </Td>
                      <Td>
                        <span className="text-xs" style={{ color: C.ink2 }}>
                          {p.channel ?? (
                            <span style={{ color: C.muted }}>Not tagged</span>
                          )}
                        </span>
                      </Td>
                      <Td align="right" mono>
                        {nf.format(Number(p.redeemed))}
                        {p.max_redemptions != null && (
                          <span style={{ color: C.muted }}> / {nf.format(p.max_redemptions)}</span>
                        )}
                      </Td>
                      <Td>
                        <span className="text-xs">
                          {p.expires_at ? fmtDate(p.expires_at) : "—"}
                        </span>
                      </Td>
                      <Td>
                        {expired ? (
                          <Tag tone="plain" dot>
                            Expired
                          </Tag>
                        ) : capped ? (
                          <Tag tone="warn" dot>
                            Fully redeemed
                          </Tag>
                        ) : p.active ? (
                          <Tag tone="ok" dot>
                            Active
                          </Tag>
                        ) : (
                          <Tag tone="plain" dot>
                            Inactive
                          </Tag>
                        )}
                      </Td>
                      <Td align="right">
                        {/* Expiry and the redemption cap are enforced by Stripe
                            and can't be undone by flipping this, so don't offer
                            a switch that would appear to revive a dead code. */}
                        <div className="flex justify-end">
                          <Toggle
                            on={p.active}
                            disabled={busy === p.id || expired || capped}
                            onChange={(next) => setActive(p.id, p.code, next)}
                            label={`${p.code} active`}
                          />
                        </div>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          )}

          <CardFooter>
            {rows.length > 0 && (
              <>
                {nf.format(rows.length)} code{rows.length === 1 ? "" : "s"} ·{" "}
                {nf.format(totalRedeemed)} total redemption
                {totalRedeemed === 1 ? "" : "s"} · read live from Stripe
              </>
            )}
          </CardFooter>
        </Card>
      </div>

      {creating && (
        <NewCodeModal
          onClose={() => setCreating(false)}
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

/** Creates a Coupon and its Promotion Code in Stripe in one step. */
function NewCodeModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (msg: string) => void;
}) {
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [value, setValue] = useState("20");
  const [duration, setDuration] = useState<"once" | "repeating" | "forever">("once");
  const [months, setMonths] = useState("3");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [channel, setChannel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/promos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          ...(discountType === "percent"
            ? { percentOff: Number(value) }
            : { amountOffGbp: Number(value) }),
          duration,
          ...(duration === "repeating" ? { durationInMonths: Number(months) } : {}),
          ...(maxRedemptions ? { maxRedemptions: Number(maxRedemptions) } : {}),
          ...(expiresAt ? { expiresAt } : {}),
          ...(channel ? { channel } : {}),
        }),
      });
      const json = await res.json();
      setSaving(false);
      if (!res.ok) {
        setError(json.error ?? "Could not create the code.");
        return;
      }
      onCreated(`${json.code} created in Stripe.`);
      onClose();
    } catch {
      setSaving(false);
      setError("Could not reach Stripe.");
    }
  };

  return (
    <Modal
      title="New promo code"
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={submit} disabled={saving || !code.trim()}>
            {saving ? "Creating…" : "Create in Stripe"}
          </Btn>
        </>
      }
    >
      <Field
        label="Code"
        help="What the teacher types at checkout. Letters, numbers, hyphens and underscores."
      >
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="BACKTOSCHOOL"
          className={fieldClass}
          style={{ ...fieldStyle, fontFamily: "ui-monospace, monospace" }}
        />
      </Field>

      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label="Discount">
          <select
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as "percent" | "amount")}
            className={fieldClass}
            style={fieldStyle}
          >
            <option value="percent">Percentage off</option>
            <option value="amount">Amount off (£)</option>
          </select>
        </Field>
        <Field label={discountType === "percent" ? "Percent off" : "Amount off (£)"}>
          <input
            type="number"
            step={discountType === "percent" ? "1" : "0.01"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={fieldClass}
            style={fieldStyle}
          />
        </Field>
      </div>

      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label="Applies for" help="How many billing periods the discount lasts.">
          <select
            value={duration}
            onChange={(e) =>
              setDuration(e.target.value as "once" | "repeating" | "forever")
            }
            className={fieldClass}
            style={fieldStyle}
          >
            <option value="once">One payment</option>
            <option value="repeating">A number of months</option>
            <option value="forever">Forever</option>
          </select>
        </Field>
        {duration === "repeating" && (
          <Field label="Months">
            <input
              type="number"
              value={months}
              onChange={(e) => setMonths(e.target.value)}
              className={fieldClass}
              style={fieldStyle}
            />
          </Field>
        )}
      </div>

      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label="Redemption limit" help="Blank means unlimited.">
          <input
            type="number"
            value={maxRedemptions}
            onChange={(e) => setMaxRedemptions(e.target.value)}
            placeholder="Unlimited"
            className={fieldClass}
            style={fieldStyle}
          />
        </Field>
        <Field label="Expires" help="Blank means it never expires.">
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className={fieldClass}
            style={fieldStyle}
          />
        </Field>
      </div>

      <Field
        label="Where it's used"
        help="Stored as the code's `channel` metadata in Stripe, for campaign attribution."
      >
        <input
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          placeholder="Twitter, BETT, newsletter…"
          className={fieldClass}
          style={fieldStyle}
        />
      </Field>

      <Note tone="warn">
        A discount can&apos;t be changed once the code exists — Stripe coupons are immutable.
        Check the numbers before creating.
      </Note>

      {error && (
        <p className="text-sm mt-2" style={{ color: C.danger }}>
          {error}
        </p>
      )}
    </Modal>
  );
}
