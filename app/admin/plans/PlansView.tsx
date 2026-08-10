"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/auth/client";
import { COST, ONBOARD_FEE, SEAT_BANDS, marginTone, worstCase } from "@/app/lib/costs";
import { gbp, nf, pence } from "../format";
import {
  Btn,
  C,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardTitle,
  Field,
  Modal,
  Note,
  PageHead,
  StatusTag,
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

export interface PlanRow {
  plan_id: string;
  name: string;
  audience: string;
  price_monthly: number | null;
  price_yearly: number | null;
  monthly_resources: number | null;
  ai_image_slideshows: number;
  description: string | null;
  status: string;
  users: number;
}

export interface PricingRule {
  key: string;
  label: string;
  description: string | null;
  enabled: boolean;
  sort: number;
}

export default function PlansView({
  plans,
  rules,
}: {
  plans: PlanRow[];
  rules: PricingRule[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<PlanRow | null>(null);
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
        title="Plans & pricing"
        sub="What each plan costs, what it includes, and what it leaves you."
      />

      <div className="grid gap-3.5 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((p) => {
          const price = Number(p.price_monthly ?? 0);
          // "If a teacher used every resource and every AI image on this plan,
          // what's left?" The AI-image allowance dominates it.
          const wc = worstCase({
            priceMonthly: price,
            // Unlimited plans have no worst case to model against; use the
            // school per-seat pool or a nominal heavy-use figure.
            monthlyResources: p.monthly_resources ?? 300,
            aiImageSlideshows: p.ai_image_slideshows,
            cardFees: p.audience !== "school",
            chargeOverheads: p.plan_id !== "free",
          });

          return (
            <Card key={p.plan_id}>
              <CardHeader>
                <div className="flex-1">
                  <CardTitle>
                    {p.name}
                    {/* Not sellable yet — seats, pooled allowances and central
                        billing are unimplemented, so nothing here is enforced
                        at runtime. Editable so the numbers can be modelled. */}
                    {p.plan_id === "school" && (
                      <span
                        className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full align-middle"
                        style={{ backgroundColor: "#FDE8C8", color: "#b07a1e" }}
                      >
                        WIP
                      </span>
                    )}
                    {/* Withdrawn from sale. Kept so existing accounts resolve
                        limits and admin MRR still counts them. */}
                    {p.plan_id === "max" && (
                      <span
                        className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full align-middle"
                        style={{ backgroundColor: "#EEECE4", color: "#8a8078" }}
                      >
                        Withdrawn
                      </span>
                    )}
                  </CardTitle>
                  <p className="text-xs" style={{ color: C.muted }}>
                    {p.audience === "school" ? "Schools" : "Teachers"}
                  </p>
                </div>
                <StatusTag status={p.status} />
              </CardHeader>
              <CardBody>
                <div className="tabular-nums" style={{ color: C.ink }}>
                  <span className="text-2xl font-bold">{price ? gbp(price) : "£0"}</span>
                  <span className="text-xs" style={{ color: C.muted }}>
                    {" "}
                    / {p.audience === "school" ? "seat/month" : "month"}
                  </span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: C.muted }}>
                  {p.price_yearly
                    ? `${gbp(Number(p.price_yearly))} ${p.audience === "school" ? "per seat per year" : "a year"}`
                    : "Free forever"}
                </p>
                <p className="text-xs mt-2" style={{ color: C.ink2 }}>
                  {p.description}
                </p>

                <div className="h-px my-3" style={{ backgroundColor: C.divider }} />

                {[
                  [
                    "Resources / month",
                    p.monthly_resources === null ? "Unlimited" : nf.format(p.monthly_resources),
                    C.ink,
                  ],
                  [
                    "AI-image slideshows",
                    p.ai_image_slideshows ? nf.format(p.ai_image_slideshows) : "—",
                    C.img,
                  ],
                  ["On this plan", nf.format(Number(p.users)), C.ink],
                ].map(([label, value, color]) => (
                  <div key={label as string} className="flex justify-between mb-1.5">
                    <span className="text-xs" style={{ color: C.muted }}>
                      {label}
                    </span>
                    <b className="text-xs tabular-nums" style={{ color: color as string }}>
                      {value}
                    </b>
                  </div>
                ))}

                <div className="h-px my-3" style={{ backgroundColor: C.divider }} />

                <div className="flex justify-between mb-1.5">
                  <span className="text-xs" style={{ color: C.muted }}>
                    Cost if fully used
                  </span>
                  <b className="text-xs tabular-nums" style={{ color: C.ink }}>
                    {gbp(wc.aiCost)}
                  </b>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs" style={{ color: C.muted }}>
                    Worst-case contribution
                  </span>
                  <b
                    className="text-xs tabular-nums"
                    style={{
                      color:
                        marginTone(wc.marginPct) === "danger"
                          ? C.danger
                          : marginTone(wc.marginPct) === "warn"
                            ? C.warn
                            : C.ok,
                    }}
                  >
                    {price ? gbp(wc.contribution) : "—"}
                  </b>
                </div>
              </CardBody>
              <CardFooter>
                <Btn size="sm" onClick={() => setEditing(p)}>
                  Edit
                </Btn>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-3.5 mt-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>School seat ladder</CardTitle>
          </CardHeader>
          <Table>
            <thead>
              <tr className="text-left">
                <Th>Seats</Th>
                <Th align="right">Per seat / mo</Th>
                <Th align="right">Per seat / yr</Th>
                <Th align="right">14-seat school</Th>
                <Th align="right">40-seat school</Th>
              </tr>
            </thead>
            <tbody>
              {SEAT_BANDS.map((b) => (
                <Tr key={b.band}>
                  <Td>
                    <span className="font-semibold" style={{ color: C.ink }}>
                      {b.band}
                    </span>
                  </Td>
                  <Td align="right" mono>
                    {gbp(b.rate)}
                  </Td>
                  <Td align="right" mono>
                    {gbp(b.rate * 12)}
                  </Td>
                  <Td align="right">
                    <span className="tabular-nums" style={{ color: C.ink2 }}>
                      {b.min <= 14 && 14 <= b.max ? gbp(b.rate * 12 * 14) : "—"}
                    </span>
                  </Td>
                  <Td align="right">
                    <span className="tabular-nums" style={{ color: C.ink2 }}>
                      {b.min <= 40 && 40 <= b.max ? gbp(b.rate * 12 * 40) : "—"}
                    </span>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <CardFooter>
            A 14-seat school lands at £714 a year — deliberately under £1,000, which most
            heads can approve without governors. Plus {gbp(ONBOARD_FEE)} onboarding.
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pricing rules</CardTitle>
          </CardHeader>
          <CardBody>
            {rules.length === 0 ? (
              <p className="text-sm" style={{ color: C.muted }}>
                No rules configured.
              </p>
            ) : (
              rules.map((r) => (
                <ToggleRow key={r.key} title={r.label} desc={r.description ?? undefined}>
                  <Toggle
                    on={r.enabled}
                    onChange={(next) => toggleRule(r.key, next)}
                    label={r.label}
                  />
                </ToggleRow>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-6">
        <Note>
          <b>Language check.</b> Nothing teacher-facing should say &ldquo;tokens&rdquo;. The
          words are <b>resources</b> and <b>AI-image slideshows</b>. This console uses the
          internal cost figures; the pricing page and dashboard must not.
        </Note>
      </div>

      {editing && (
        <EditPlanModal
          plan={editing}
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

function EditPlanModal({
  plan,
  onClose,
  onSaved,
}: {
  plan: PlanRow;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [name, setName] = useState(plan.name);
  const [monthly, setMonthly] = useState(String(plan.price_monthly ?? ""));
  const [yearly, setYearly] = useState(String(plan.price_yearly ?? ""));
  const [resources, setResources] = useState(String(plan.monthly_resources ?? ""));
  const [aiImages, setAiImages] = useState(String(plan.ai_image_slideshows));
  const [description, setDescription] = useState(plan.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: e } = await supabase.rpc("admin_update_plan", {
      p_plan_id: plan.plan_id,
      payload: {
        name,
        price_monthly: monthly === "" ? null : Number(monthly),
        price_yearly: yearly === "" ? null : Number(yearly),
        monthly_resources: resources === "" ? null : Number(resources),
        ai_image_slideshows: Number(aiImages),
        description,
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
      title={`Edit ${plan.name}`}
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={submit} disabled={saving}>
            {saving ? "Saving…" : "Save plan"}
          </Btn>
        </>
      }
    >
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label="Plan name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={fieldClass}
            style={fieldStyle}
          />
        </Field>
        <Field label="Price (£/month)">
          <input
            type="number"
            step="0.01"
            value={monthly}
            onChange={(e) => setMonthly(e.target.value)}
            className={fieldClass}
            style={fieldStyle}
          />
        </Field>
        <Field label="Annual price (£)">
          <input
            type="number"
            step="0.01"
            value={yearly}
            onChange={(e) => setYearly(e.target.value)}
            className={fieldClass}
            style={fieldStyle}
          />
        </Field>
        <Field label="Resources / month" help="Blank means unlimited.">
          <input
            type="number"
            value={resources}
            onChange={(e) => setResources(e.target.value)}
            className={fieldClass}
            style={fieldStyle}
          />
        </Field>
      </div>

      <Field
        label="AI-image slideshows / month"
        help={`Each costs about ${pence(COST.deckAI)} — roughly 33x a text resource. This is the number that decides whether the plan makes money.`}
      >
        <input
          type="number"
          value={aiImages}
          onChange={(e) => setAiImages(e.target.value)}
          className={fieldClass}
          style={fieldStyle}
        />
      </Field>

      <Field label="One-line description (shows on the pricing page)">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={fieldClass}
          style={fieldStyle}
        />
      </Field>

      <Note tone="warn">
        <b>{nf.format(Number(plan.users))} teachers are on this plan.</b> Editing here changes
        what the console and pricing page display. It does <b>not</b> touch Stripe — Price
        objects are immutable, so a real price change means creating a new Price in Stripe and
        updating the env vars.
      </Note>

      {error && (
        <p className="text-sm mt-2" style={{ color: C.danger }}>
          {error}
        </p>
      )}
    </Modal>
  );
}
