"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/auth/client";
import { fmtDate, gbp, nf } from "../format";
import {
  Btn,
  C,
  Card,
  CardFooter,
  EmptyState,
  Field,
  Modal,
  Note,
  PageHead,
  StatusTag,
  Table,
  Td,
  Th,
  Tr,
  fieldClass,
  fieldStyle,
  useToast,
} from "../ui";

export interface PromoRow {
  id: string;
  code: string;
  offer: string;
  channel: string | null;
  redeemed: number;
  revenue_gbp: number;
  expires_at: string | null;
  status: string;
}

export default function PromosView({ rows }: { rows: PromoRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<PromoRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [toastNode, fire] = useToast();

  return (
    <>
      <PageHead
        title="Promo codes"
        sub="For campaigns, conferences and win-backs. Each code reports its own signups and revenue."
      >
        <Btn variant="primary" onClick={() => setCreating(true)}>
          + New code
        </Btn>
      </PageHead>

      <Card>
        {rows.length === 0 ? (
          <EmptyState
            title="No promo codes yet"
            body="Create one here, then mirror it as a promotion code in Stripe so checkout actually accepts it."
            action={
              <Btn variant="primary" onClick={() => setCreating(true)}>
                New code
              </Btn>
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
                <Th align="right">Revenue</Th>
                <Th>Expires</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <Tr key={p.id}>
                  <Td>
                    <span className="font-mono font-semibold text-xs" style={{ color: C.ink }}>
                      {p.code}
                    </span>
                  </Td>
                  <Td>{p.offer}</Td>
                  <Td>
                    <span className="text-xs" style={{ color: C.ink2 }}>
                      {p.channel ?? "—"}
                    </span>
                  </Td>
                  <Td align="right" mono>
                    {nf.format(Number(p.redeemed))}
                  </Td>
                  <Td align="right" mono>
                    {gbp(Number(p.revenue_gbp))}
                  </Td>
                  <Td>
                    <span className="text-xs">{p.expires_at ? fmtDate(p.expires_at) : "—"}</span>
                  </Td>
                  <Td>
                    <StatusTag status={p.status} />
                  </Td>
                  <Td align="right">
                    <Btn size="sm" onClick={() => setEditing(p)}>
                      Edit
                    </Btn>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
        <CardFooter>
          Redemption and revenue are recorded against the matching Stripe promotion code.
          Creating a code here does not create it in Stripe.
        </CardFooter>
      </Card>

      {(creating || editing) && (
        <PromoModal
          promo={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={(msg) => {
            fire(msg);
            router.refresh();
          }}
        />
      )}
      {toastNode}
    </>
  );
}

function PromoModal({
  promo,
  onClose,
  onSaved,
}: {
  promo: PromoRow | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [code, setCode] = useState(promo?.code ?? "");
  const [offer, setOffer] = useState(promo?.offer ?? "");
  const [channel, setChannel] = useState(promo?.channel ?? "");
  const [expiresAt, setExpiresAt] = useState(promo?.expires_at ?? "");
  const [status, setStatus] = useState(promo?.status === "expired" ? "draft" : (promo?.status ?? "draft"));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: e } = await supabase.rpc("admin_upsert_promo", {
      payload: {
        id: promo?.id ?? null,
        code,
        offer,
        channel,
        expires_at: expiresAt || null,
        status,
      },
    });
    setSaving(false);
    if (e) {
      setError(e.message);
      return;
    }
    onSaved(`${code.toUpperCase()} saved.`);
    onClose();
  };

  return (
    <Modal
      title={promo ? `Edit ${promo.code}` : "New promo code"}
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={submit} disabled={saving || !code.trim()}>
            {saving ? "Saving…" : "Save code"}
          </Btn>
        </>
      }
    >
      <Field label="Code" help="Upper-cased automatically. Must match the Stripe promotion code.">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="BACKTOSCHOOL"
          disabled={!!promo}
          className={fieldClass}
          style={fieldStyle}
        />
      </Field>
      <Field label="Offer">
        <input
          value={offer}
          onChange={(e) => setOffer(e.target.value)}
          placeholder="50% off 3 months"
          className={fieldClass}
          style={fieldStyle}
        />
      </Field>
      <Field label="Where it's used">
        <input
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          placeholder="Meta + TikTok, August"
          className={fieldClass}
          style={fieldStyle}
        />
      </Field>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label="Expires">
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className={fieldClass}
            style={fieldStyle}
          />
        </Field>
        <Field label="Status">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={fieldClass}
            style={fieldStyle}
          >
            <option value="draft">Draft</option>
            <option value="live">Live</option>
          </select>
        </Field>
      </div>

      <Note tone="warn">
        This records the campaign for reporting. The code still has to exist as a promotion
        code in Stripe — checkout already passes <code>allow_promotion_codes</code>, so once
        it&apos;s created there it will be accepted.
      </Note>

      {error && (
        <p className="text-sm mt-2" style={{ color: C.danger }}>
          {error}
        </p>
      )}
    </Modal>
  );
}
