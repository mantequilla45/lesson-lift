"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/auth/client";
import { COST } from "@/app/lib/costs";
import { gbp, nf } from "../format";
import { type PricingRule } from "../plans/PlansView";
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
  Modal,
  PageHead,
  Stat,
  Table,
  Tag,
  Td,
  Th,
  Toggle,
  ToggleRow,
  Tr,
  fieldClass,
  fieldStyle,
  useToast,
} from "../ui";

export interface TopupPack {
  id: string;
  kind: string;
  name: string;
  price_gbp: number;
  unit: number;
  available_to: string[];
  active: boolean;
  sold: number;
  revenue_gbp: number;
}

export interface TopupSummary {
  sold_total: number;
  sold_this_month: number;
  revenue_total: number;
  revenue_this_month: number;
  ai_packs: number;
  repeat_buyers: number;
}

/** What a pack of this kind costs Jooma to fulfil, from the measured cost sheet. */
function packCost(pack: TopupPack): number {
  return pack.kind === "ai_image" ? pack.unit * COST.deckAI : pack.unit * COST.text;
}

export default function TopupsView({
  packs,
  summary,
  rules,
}: {
  packs: TopupPack[];
  summary: TopupSummary | null;
  rules: PricingRule[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<TopupPack | null>(null);
  const [toastNode, fire] = useToast();

  const toggleRule = async (key: string, enabled: boolean) => {
    const supabase = createClient();
    const { error } = await supabase.rpc("admin_set_pricing_rule", {
      p_key: key,
      p_enabled: enabled,
    });
    if (error) {
      fire(error.message);
      return;
    }
    router.refresh();
  };

  return (
    <>
      <PageHead
        title="Top-ups"
        sub="What a teacher can buy when they run out mid-month. Two separate pools — resources are cheap, AI images are not."
      />

      <div className="grid gap-3.5 mb-6 grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Top-ups sold"
          value={nf.format(Number(summary?.sold_total ?? 0))}
          foot={`${nf.format(Number(summary?.sold_this_month ?? 0))} this month`}
        />
        <Stat
          label="Top-up revenue"
          value={gbp(Number(summary?.revenue_total ?? 0))}
          foot={`${gbp(Number(summary?.revenue_this_month ?? 0))} this month`}
        />
        <Stat
          label="AI image packs"
          value={nf.format(Number(summary?.ai_packs ?? 0))}
          foot="of all packs sold"
        />
        <Stat
          label="Repeat buyers"
          value={nf.format(Number(summary?.repeat_buyers ?? 0))}
          foot="bought more than once"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Packs</CardTitle>
        </CardHeader>
        {packs.length === 0 ? (
          <EmptyState title="No packs configured" />
        ) : (
          <Table>
            <thead>
              <tr className="text-left">
                <Th>Pack</Th>
                <Th>Pool</Th>
                <Th align="right">Price</Th>
                <Th align="right">Costs us</Th>
                <Th align="right">Margin</Th>
                <Th align="right">Sold</Th>
                <Th>Available to</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {packs.map((p) => {
                const cost = packCost(p);
                const price = Number(p.price_gbp);
                const margin = price > 0 ? (price - cost) / price : 0;
                return (
                  <Tr key={p.id}>
                    <Td>
                      <span className="font-semibold" style={{ color: C.ink }}>
                        {p.name}
                      </span>
                      {!p.active && (
                        <span className="ml-2">
                          <Tag>Inactive</Tag>
                        </span>
                      )}
                    </Td>
                    <Td>
                      <Tag tone={p.kind === "ai_image" ? "img" : "ai"} dot>
                        {p.kind === "ai_image" ? "AI images" : "Resources"}
                      </Tag>
                    </Td>
                    <Td align="right" mono>
                      {gbp(price)}
                    </Td>
                    <Td align="right">
                      <span className="tabular-nums" style={{ color: C.ink2 }}>
                        {gbp(cost)}
                      </span>
                    </Td>
                    <Td align="right">
                      <Tag tone={margin < 0.35 ? "warn" : "ok"}>{Math.round(margin * 100)}%</Tag>
                    </Td>
                    <Td align="right" mono>
                      {nf.format(Number(p.sold))}
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {p.available_to.map((plan) => (
                          <Tag key={plan} tone={plan === "free" ? "plain" : "brand"}>
                            {plan}
                          </Tag>
                        ))}
                      </div>
                    </Td>
                    <Td align="right">
                      <Btn size="sm" onClick={() => setEditing(p)}>
                        Edit
                      </Btn>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
        <CardFooter>
          AI image packs run at a much thinner margin than resource packs — that&apos;s
          deliberate. They exist to stop heavy users going underwater, not to make money. If
          someone buys two in a month, sell them Max instead.
        </CardFooter>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Rules</CardTitle>
        </CardHeader>
        <CardBody>
          {rules.length === 0 ? (
            <p className="text-sm" style={{ color: C.muted }}>
              No rules configured.
            </p>
          ) : (
            rules.map((r) => (
              <ToggleRow key={r.key} title={r.label} desc={r.description ?? undefined}>
                <Toggle on={r.enabled} onChange={(next) => toggleRule(r.key, next)} label={r.label} />
              </ToggleRow>
            ))
          )}
        </CardBody>
      </Card>

      {editing && (
        <EditPackModal
          pack={editing}
          onClose={() => setEditing(null)}
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

function EditPackModal({
  pack,
  onClose,
  onSaved,
}: {
  pack: TopupPack;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [name, setName] = useState(pack.name);
  const [price, setPrice] = useState(String(pack.price_gbp));
  const [unit, setUnit] = useState(String(pack.unit));
  const [active, setActive] = useState(pack.active);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cost =
    pack.kind === "ai_image" ? Number(unit) * COST.deckAI : Number(unit) * COST.text;
  const margin = Number(price) > 0 ? (Number(price) - cost) / Number(price) : 0;

  const submit = async () => {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: e } = await supabase.rpc("admin_upsert_topup_pack", {
      payload: {
        id: pack.id,
        name,
        price_gbp: Number(price),
        unit: Number(unit),
        active,
      },
    });
    setSaving(false);
    if (e) {
      setError(e.message);
      return;
    }
    onSaved(`${name} saved.`);
    onClose();
  };

  return (
    <Modal
      title={`Edit ${pack.name}`}
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={submit} disabled={saving}>
            {saving ? "Saving…" : "Save pack"}
          </Btn>
        </>
      }
    >
      <Field label="Pack name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={fieldClass}
          style={fieldStyle}
        />
      </Field>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label="Price (£)">
          <input
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className={fieldClass}
            style={fieldStyle}
          />
        </Field>
        <Field label={pack.kind === "ai_image" ? "AI slideshows" : "Resources"}>
          <input
            type="number"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className={fieldClass}
            style={fieldStyle}
          />
        </Field>
      </div>

      <div
        className="rounded-xl border px-3.5 py-3 text-sm"
        style={{ borderColor: C.border, backgroundColor: C.white }}
      >
        <div className="flex justify-between mb-1">
          <span style={{ color: C.muted }}>Costs us to fulfil</span>
          <span className="tabular-nums" style={{ color: C.ink }}>
            {gbp(cost)}
          </span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: C.muted }}>Margin</span>
          <span
            className="tabular-nums font-semibold"
            style={{ color: margin < 0 ? C.danger : margin < 0.35 ? C.warn : C.ok }}
          >
            {Math.round(margin * 100)}%
          </span>
        </div>
      </div>

      <div className="mt-3">
        <ToggleRow title="Active" desc="Inactive packs are hidden from teachers.">
          <Toggle on={active} onChange={setActive} label="Active" />
        </ToggleRow>
      </div>

      {error && (
        <p className="text-sm mt-2" style={{ color: C.danger }}>
          {error}
        </p>
      )}
    </Modal>
  );
}
