"use client";

import { useState } from "react";
import { createClient } from "@/app/lib/auth/client";
import { COST } from "@/app/lib/costs";
import { gbp, pence } from "../format";
import { Btn, C, Field, Modal, fieldClass, fieldStyle } from "../ui";

export type GrantKind = "resource" | "ai_image" | "credit_gbp";

const REASONS = [
  "Goodwill — support issue",
  "Compensating a failed generation",
  "Trial extension",
  "School pool transfer",
  "Other",
];

export default function GrantModal({
  userId,
  name,
  kind,
  onClose,
  onGranted,
}: {
  userId: string;
  name: string;
  kind: GrantKind;
  onClose: () => void;
  onGranted: (msg: string) => void;
}) {
  const isAI = kind === "ai_image";
  const isCredit = kind === "credit_gbp";

  // Credit is entered in POUNDS (and stored as pence — see the cost_ceiling
  // migration). The unit kinds are entered as whole units.
  //
  // Defaults are one sensible helping, not a round number: a free teacher gets
  // 5 resources a month, so defaulting to 100 would hand out 20 months of
  // allowance in one click. £1.50 matches the top-up a Pro teacher would have
  // bought themselves.
  const [amount, setAmount] = useState(isCredit ? 1.5 : isAI ? 3 : 5);
  const [reason, setReason] = useState(REASONS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // What this grant actually costs Jooma, using the measured cost sheet. Shown
  // live because an AI-image grant is ~33x a resource grant and that should be
  // impossible to miss at the moment of granting. Credit is already money, so
  // it is its own estimate.
  const unit = isAI ? COST.deckAI : COST.text;
  const estimate = isCredit ? amount : amount * unit;

  const max = isCredit ? 50 : isAI ? 500 : 10000;
  const valid = amount > 0 && amount <= max;

  const submit = async () => {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("admin_grant_allowance", {
      uid: userId,
      p_kind: kind,
      // Pence for credit, whole units otherwise. Rounded because a stray
      // fraction of a penny would fail the integer column.
      p_amount: isCredit ? Math.round(amount * 100) : Math.round(amount),
      p_reason: reason,
    });
    setSaving(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    onGranted(
      isCredit
        ? `Granted ${gbp(amount)} of AI credit to ${name}.`
        : `Granted ${amount} ${isAI ? "AI-image slideshows" : "resources"} to ${name}.`,
    );
    onClose();
  };

  return (
    <Modal
      title={`Grant ${isCredit ? "AI credit" : isAI ? "AI-image slideshows" : "resources"} to ${name}`}
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={submit} disabled={saving || !valid}>
            {saving ? "Granting…" : "Grant"}
          </Btn>
        </>
      }
    >
      <Field
        label={isCredit ? "How much (£)" : "How many"}
        help={
          isCredit ? (
            <>
              Tops up their monthly AI spend allowance, the same way a paid £1.50
              top-up does. This is what unblocks a Pro teacher who has hit their
              spend ceiling. Expires at the end of the month and doesn&apos;t roll
              over. Max £50.
            </>
          ) : (
            <>
              Each {isAI ? "AI-image slideshow" : "resource"} costs about{" "}
              <b>{pence(unit)}</b>, so this grant is roughly <b>{gbp(estimate)}</b>. Goes on top
              of this month&apos;s allowance and doesn&apos;t roll over.
            </>
          )
        }
      >
        <input
          type="number"
          min={isCredit ? 0.5 : 1}
          max={max}
          step={isCredit ? 0.5 : 1}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className={fieldClass}
          style={fieldStyle}
        />
      </Field>

      <Field label="Reason (shows in the audit log)">
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className={fieldClass}
          style={fieldStyle}
        >
          {REASONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </Field>

      {error && (
        <p className="text-sm mt-2" style={{ color: C.danger }}>
          {error}
        </p>
      )}
    </Modal>
  );
}
