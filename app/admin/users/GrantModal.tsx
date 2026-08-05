"use client";

import { useState } from "react";
import { createClient } from "@/app/lib/auth/client";
import { COST } from "@/app/lib/costs";
import { gbp, pence } from "../format";
import { Btn, C, Field, Modal, fieldClass, fieldStyle } from "../ui";

export type GrantKind = "resource" | "ai_image";

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
  const [amount, setAmount] = useState(isAI ? 10 : 100);
  const [reason, setReason] = useState(REASONS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // What this grant actually costs Jooma, using the measured cost sheet. Shown
  // live because an AI-image grant is ~33x a resource grant and that should be
  // impossible to miss at the moment of granting.
  const unit = isAI ? COST.deckAI : COST.text;
  const estimate = amount * unit;

  const submit = async () => {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("admin_grant_allowance", {
      uid: userId,
      p_kind: kind,
      p_amount: amount,
      p_reason: reason,
    });
    setSaving(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    onGranted(
      `Granted ${amount} ${isAI ? "AI-image slideshows" : "resources"} to ${name}.`,
    );
    onClose();
  };

  return (
    <Modal
      title={`Grant ${isAI ? "AI-image slideshows" : "resources"} to ${name}`}
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={submit} disabled={saving || amount <= 0}>
            {saving ? "Granting…" : "Grant"}
          </Btn>
        </>
      }
    >
      <Field
        label="How many"
        help={
          <>
            Each {isAI ? "AI-image slideshow" : "resource"} costs about{" "}
            <b>{pence(unit)}</b>, so this grant is roughly <b>{gbp(estimate)}</b>. Goes on top
            of this month&apos;s allowance and doesn&apos;t roll over.
          </>
        }
      >
        <input
          type="number"
          min={1}
          max={isAI ? 500 : 10000}
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
