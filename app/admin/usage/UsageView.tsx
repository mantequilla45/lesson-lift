"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/auth/client";
import { COST } from "@/app/lib/costs";
import { marginTone } from "@/app/lib/costs";
import { gbp, gbpFromUsd, nf, penceFromUsd } from "../format";
import ModelRoutingCard, { type ModelRow } from "../ModelRoutingCard";
import {
  BypassTag,
  C,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardTitle,
  Disclosure,
  EmptyState,
  Note,
  PLAN_TONE,
  PageHead,
  Stat,
  Table,
  Tag,
  Td,
  Th,
  Toggle,
  ToggleRow,
  Tr,
  inputClass,
  inputStyle,
  useToast,
} from "../ui";

export interface UsageSummary {
  ai_spend_usd: number;
  ai_image_cost_usd: number;
  text_cost_usd: number;
  generations: number;
  ai_images: number;
  active_teachers: number;
  cost_per_active_usd: number;
  mrr_gbp: number;
  gross_margin: number | null;
}

export interface TopTool {
  tool_slug: string;
  label: string;
  generations: number;
  cost_usd: number;
  cost_per_run: number;
}

export interface MarginRow {
  user_id: string;
  teacher: string;
  email: string | null;
  plan: string;
  is_admin: boolean;
  /** Plan price + top-ups bought this month. */
  revenue_gbp: number;
  plan_revenue_gbp: number;
  topup_revenue_gbp: number;
  cost_usd: number;
  ai_images: number;
  generations: number;
  contribution_gbp: number;
  margin_pct: number | null;
}

export type { ModelRow };

export interface FairUseRule {
  key: string;
  label: string;
  description: string | null;
  section: string;
  value: boolean | number | string;
  sort: number;
}

export default function UsageView({
  summary,
  topTools,
  margins,
  models,
  fairUse,
  toolTable,
  toolCount,
}: {
  summary: UsageSummary | null;
  topTools: TopTool[];
  margins: MarginRow[];
  models: ModelRow[];
  fairUse: FairUseRule[];
  /** The full per-tool table, kept as the detail section beneath the summary. */
  toolTable: React.ReactNode;
  /** Row count for the collapsed header, so the section can be sized without
   *  rendering the table. */
  toolCount: number;
}) {
  const router = useRouter();
  const [toastNode, fire] = useToast();
  const [pending, setPending] = useState<Record<string, number>>({});

  const spend = Number(summary?.ai_spend_usd ?? 0);
  const imageCost = Number(summary?.ai_image_cost_usd ?? 0);
  const gens = Number(summary?.generations ?? 0);
  const images = Number(summary?.ai_images ?? 0);
  const active = Number(summary?.active_teachers ?? 0);
  const margin = summary?.gross_margin === null ? null : Number(summary?.gross_margin ?? 0);
  const imageShare = spend > 0 ? (imageCost / spend) * 100 : 0;

  // Admins bypass the cap, so their cost is internal usage rather than a
  // margin problem to act on.
  const underwater = margins.filter(
    (r) => !r.is_admin && r.margin_pct !== null && Number(r.contribution_gbp) < 0,
  ).length;

  const maxToolCost = Math.max(...topTools.map((t) => t.cost_usd), 0.0001);

  // Drives the warning banner above. Defaults to on when the setting is absent:
  // a missing row should not silently hide a margin problem.
  const alertNegativeMargin =
    fairUse.find((s) => s.key === "alert_negative_margin")?.value !== false;

  const saveSetting = async (key: string, value: boolean | number, label: string) => {
    const supabase = createClient();
    const { error } = await supabase.rpc("admin_set_setting", { p_key: key, p_value: value });
    if (error) {
      fire(error.message);
      return;
    }
    fire(`${label} updated.`);
    router.refresh();
  };

  return (
    <>
      <PageHead
        title="Usage & margins"
        sub="What teachers are generating, what it costs you, and who is costing more than they pay."
      />

      {/* ── Headline figures ─────────────────────────────────────────── */}
      <div className="grid gap-3.5 grid-cols-2 lg:grid-cols-4 mb-4">
        <Stat
          label="AI spend this month"
          value={gbpFromUsd(spend)}
          foot="measured, not estimated"
        />
        <Stat
          label="AI images share"
          value={spend > 0 ? `${imageShare.toFixed(0)}%` : "—"}
          foot={
            images > 0
              ? `of total AI cost, from ${nf.format(images)} image${images === 1 ? "" : "s"}`
              : "no images generated yet"
          }
        />
        <Stat
          label="Cost per active teacher"
          value={active > 0 ? gbpFromUsd(Number(summary?.cost_per_active_usd ?? 0)) : "—"}
          foot={
            active > 0
              ? `${nf.format(active)} generated something this month`
              : "nobody active this month"
          }
        />
        <Stat
          label="Gross margin"
          value={margin === null ? "—" : `${(margin * 100).toFixed(1)}%`}
          foot={
            margin === null
              ? "no subscription revenue yet"
              : `on ${gbp(Number(summary?.mrr_gbp ?? 0))} MRR, after AI cost`
          }
        />
      </div>

      {/* ── Negative-margin warning ──────────────────────────────────── */}
      {/* Gated on the alert_negative_margin setting below, which is what makes
          that toggle do something real. In-console only — there is no
          scheduler, so nothing can email about this. */}
      {alertNegativeMargin && underwater > 0 && (
        <div className="mb-4">
          <Note tone="danger">
            <b>
              {nf.format(underwater)} paying teacher{underwater === 1 ? "" : "s"} cost more than
              they pay.
            </b>{" "}
            They are in <i>Thinnest margins</i> below. Offer a higher plan or an AI top-up —
            leaving it alone is the one thing that reliably makes it worse.
          </Note>
        </div>
      )}

      {/* ── The lever that matters ───────────────────────────────────── */}
      {imageShare > 25 ? (
        <div className="mb-4">
          <Note tone="warn">
            <b>The single lever that matters.</b> AI-generated images cost about{" "}
            {penceFromUsd(images > 0 ? imageCost / images : COST.image)} each against{" "}
            {penceFromUsd(gens > 0 ? Number(summary?.text_cost_usd ?? 0) / gens : COST.text)} for
            a text generation. They are <b>{imageShare.toFixed(0)}% of your AI bill</b> from{" "}
            {nf.format(images)} image{images === 1 ? "" : "s"}. Fewer images per deck moves
            gross margin faster than anything else on this page.
          </Note>
        </div>
      ) : (
        spend > 0 && (
          <div className="mb-4">
            <Note>
              AI images are <b>{imageShare.toFixed(0)}% of AI cost</b> this month. They cost
              roughly 33× a text generation, so watch this figure as slideshow use grows — it
              is the fastest-moving line in the cost base.
            </Note>
          </div>
        )
      )}

      {/* ── Where the money goes / Thinnest margins ──────────────────── */}
      <div className="grid gap-3.5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Where the money goes</CardTitle>
          </CardHeader>
          {topTools.length === 0 ? (
            <EmptyState
              title="No cost recorded this month"
              body="Tool costs appear here as teachers generate."
            />
          ) : (
            <Table>
              <thead>
                <tr className="text-left">
                  <Th>Tool</Th>
                  <Th align="right">Runs</Th>
                  <Th align="right">Each</Th>
                  <Th align="right">Total</Th>
                  <Th width="90px" />
                </tr>
              </thead>
              <tbody>
                {topTools.map((t) => {
                  // Anything well above the blended average is where margin
                  // goes; the slideshow tools are the usual culprits.
                  const isDriver = t.cost_per_run > 0.03;
                  return (
                    <Tr key={t.tool_slug}>
                      <Td>
                        <span className="font-medium" style={{ color: C.ink }}>
                          {t.label}
                        </span>
                        {isDriver && (
                          <span className="ml-1.5">
                            <Tag tone="img">cost driver</Tag>
                          </span>
                        )}
                      </Td>
                      <Td align="right" mono>
                        {nf.format(t.generations)}
                      </Td>
                      <Td align="right">
                        <span className="tabular-nums" style={{ color: C.ink2 }}>
                          {penceFromUsd(t.cost_per_run)}
                        </span>
                      </Td>
                      <Td align="right">
                        <span className="tabular-nums font-semibold" style={{ color: C.ink }}>
                          {gbpFromUsd(t.cost_usd)}
                        </span>
                      </Td>
                      <Td>
                        <div className="h-1.5 rounded" style={{ backgroundColor: C.divider }}>
                          <div
                            className="h-full rounded"
                            style={{
                              width: `${(t.cost_usd / maxToolCost) * 100}%`,
                              backgroundColor: isDriver ? C.img : C.ai,
                            }}
                          />
                        </div>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          )}
          <CardFooter>Top {topTools.length} by spend this month.</CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Thinnest margins</CardTitle>
            {underwater > 0 ? (
              <Tag tone="danger">{nf.format(underwater)} losing money</Tag>
            ) : (
              <Tag tone="warn">watch these</Tag>
            )}
          </CardHeader>
          {margins.length === 0 ? (
            <EmptyState
              title="Nobody has generated anything this month"
              body="Whoever costs the most against what they pay appears here."
            />
          ) : (
            <Table>
              <thead>
                <tr className="text-left">
                  <Th>Teacher</Th>
                  <Th>Plan</Th>
                  <Th align="right">Pays</Th>
                  <Th align="right">Costs</Th>
                  <Th align="right">Margin</Th>
                </tr>
              </thead>
              <tbody>
                {margins.map((r) => {
                  const m = r.margin_pct === null ? null : Number(r.margin_pct);
                  return (
                    <Tr key={r.user_id}>
                      <Td>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium" style={{ color: C.ink }}>
                            {r.teacher}
                          </span>
                          {r.is_admin && <BypassTag compact />}
                        </div>
                        <div className="text-xs" style={{ color: C.muted }}>
                          {Number(r.ai_images) > 0 ? (
                            <span style={{ color: C.img }}>
                              {nf.format(Number(r.ai_images))} AI image
                              {Number(r.ai_images) === 1 ? "" : "s"}
                            </span>
                          ) : (
                            `${nf.format(Number(r.generations))} generation${
                              Number(r.generations) === 1 ? "" : "s"
                            }`
                          )}
                        </div>
                      </Td>
                      <Td>
                        <Tag tone={PLAN_TONE[r.plan] ?? "plain"}>{r.plan}</Tag>
                      </Td>
                      <Td align="right">
                        <div className="tabular-nums" style={{ color: C.ink }}>
                          {gbp(Number(r.revenue_gbp))}
                        </div>
                        {/* A top-up is revenue AND an allowance increase, so
                            showing only the total would leave an unexplained
                            figure that matches no price on the Plans page. */}
                        {Number(r.topup_revenue_gbp) > 0 && (
                          <div className="text-xs tabular-nums" style={{ color: C.ok }}>
                            {gbp(Number(r.plan_revenue_gbp))} +{" "}
                            {gbp(Number(r.topup_revenue_gbp))} top-up
                          </div>
                        )}
                      </Td>
                      <Td align="right" mono>
                        {gbpFromUsd(Number(r.cost_usd))}
                      </Td>
                      <Td align="right">
                        {r.is_admin ? (
                          <Tag title="Internal usage — not a paying account">internal</Tag>
                        ) : m === null ? (
                          <Tag>free plan</Tag>
                        ) : (
                          <Tag tone={marginTone(m)}>{Math.round(m * 100)}%</Tag>
                        )}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          )}
          <CardFooter>
            Anyone red should be offered a higher plan or an AI top-up, not left alone. Free
            teachers who have never paid show cost only — they are acquisition spend, not a
            margin problem. A free teacher who has bought a top-up has real revenue and a real
            margin, and appears here like anyone else.
          </CardFooter>
        </Card>
      </div>

      {/* ── Model routing ────────────────────────────────────────────── */}
      <div className="mt-3.5">
        <ModelRoutingCard models={models} />
      </div>

      {/* ── Fair use ─────────────────────────────────────────────────── */}
      {fairUse.length > 0 && (
        <div className="mt-3.5">
          <Card>
            <CardHeader>
              <CardTitle>Fair use and abuse</CardTitle>
            </CardHeader>
            <CardBody>
              {fairUse.map((s) => {
                const isNumber = typeof s.value === "number";
                const desc =
                  s.key === "alert_negative_margin" && underwater > 0
                    ? `Currently ${nf.format(underwater)} teacher${underwater === 1 ? "" : "s"}. This is the alert that protects your unit economics.`
                    : (s.description ?? undefined);
                return (
                  <ToggleRow key={s.key} title={s.label} desc={desc}>
                    {isNumber ? (
                      <input
                        type="number"
                        defaultValue={Number(s.value)}
                        onChange={(e) =>
                          setPending((p) => ({ ...p, [s.key]: Number(e.target.value) }))
                        }
                        onBlur={() => {
                          const next = pending[s.key];
                          if (next !== undefined && next !== Number(s.value)) {
                            saveSetting(s.key, next, s.label);
                          }
                        }}
                        className={inputClass}
                        style={{ ...inputStyle, width: 90 }}
                      />
                    ) : (
                      <Toggle
                        on={Boolean(s.value)}
                        onChange={(next) => saveSetting(s.key, next, s.label)}
                        label={s.label}
                      />
                    )}
                  </ToggleRow>
                );
              })}
            </CardBody>
            <CardFooter>
              Both of these are live. The rate limit is checked on every generation (0 means no
              limit); the margin warning is the red banner at the top of this page. There is no
              email alerting yet — nothing here will reach an inbox.
            </CardFooter>
          </Card>
        </div>
      )}

      {/* ── Full per-tool detail ─────────────────────────────────────── */}
      {/* Collapsed by default. This is 35 rows of detail that answers a
          question you only ask once the summary above has told you where to
          look — expanded, it pushed that summary off the screen. */}
      <div className="mt-6">
        <Disclosure
          title="Every tool"
          count={`${nf.format(toolCount)} tools`}
          sub="All tools including unused ones, with per-generation cost and 10× / 100× volume projections. Expand a row to see its step breakdown; use Select to reset a tool's recorded usage."
        >
          {toolTable}
        </Disclosure>
      </div>

      {toastNode}
    </>
  );
}
