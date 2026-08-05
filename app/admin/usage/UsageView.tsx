"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/auth/client";
import { COST } from "@/app/lib/costs";
import { marginTone } from "@/app/lib/costs";
import { gbp, gbpFromUsd, nf, penceFromUsd } from "../format";
import {
  BypassTag,
  C,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardTitle,
  EmptyState,
  Note,
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
  revenue_gbp: number;
  cost_usd: number;
  ai_images: number;
  generations: number;
  contribution_gbp: number;
  margin_pct: number | null;
}

export interface ModelRow {
  model: string;
  runs: number;
  total_tokens: number;
  cost_usd: number;
  cost_per_run: number;
  tools: number;
}

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
}: {
  summary: UsageSummary | null;
  topTools: TopTool[];
  margins: MarginRow[];
  models: ModelRow[];
  fairUse: FairUseRule[];
  /** The full per-tool table, kept as the detail section beneath the summary. */
  toolTable: React.ReactNode;
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
                        <Tag tone={r.plan === "free" ? "plain" : "brand"}>{r.plan}</Tag>
                      </Td>
                      <Td align="right" mono>
                        {gbp(Number(r.revenue_gbp))}
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
            teachers show cost only — they are acquisition spend, not a margin problem.
          </CardFooter>
        </Card>
      </div>

      {/* ── Model routing ────────────────────────────────────────────── */}
      <div className="mt-3.5">
        <Card>
          <CardHeader>
            <CardTitle>Model routing</CardTitle>
            {models.length > 0 && (
              <Tag tone="ai">
                {models.length} model{models.length === 1 ? "" : "s"} in use
              </Tag>
            )}
          </CardHeader>
          {models.length === 0 ? (
            <EmptyState title="No generations recorded this month" />
          ) : (
            <Table>
              <thead>
                <tr className="text-left">
                  <Th>Model</Th>
                  <Th align="right">Runs</Th>
                  <Th align="right">Tokens</Th>
                  <Th align="right">Cost / run</Th>
                  <Th align="right">Cost this month</Th>
                  <Th align="right">Tools</Th>
                </tr>
              </thead>
              <tbody>
                {models.map((m) => (
                  <Tr key={m.model}>
                    <Td>
                      <Tag tone={m.model.includes("mini") ? "ok" : "plain"}>{m.model}</Tag>
                    </Td>
                    <Td align="right" mono>
                      {nf.format(Number(m.runs))}
                    </Td>
                    <Td align="right" mono>
                      {nf.format(Number(m.total_tokens))}
                    </Td>
                    <Td align="right" mono>
                      {penceFromUsd(Number(m.cost_per_run))}
                    </Td>
                    <Td align="right" mono>
                      {gbpFromUsd(Number(m.cost_usd))}
                    </Td>
                    <Td align="right" mono>
                      {nf.format(Number(m.tools))}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
          <CardFooter>
            Routing is decided in each tool&apos;s API route, not here. Test quality on a
            handful before switching anything — a cheaper lesson plan a teacher doesn&apos;t
            trust costs far more than the saving.
          </CardFooter>
        </Card>
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
              These are recorded here but not yet enforced by the app — see issue #26.
            </CardFooter>
          </Card>
        </div>
      )}

      {/* ── Full per-tool detail ─────────────────────────────────────── */}
      <div className="mt-6">
        <h2 className="text-sm font-bold mb-1" style={{ color: C.ink }}>
          Every tool
        </h2>
        <p className="text-xs mb-3" style={{ color: C.muted }}>
          All tools including unused ones, with per-generation cost and 10× / 100× volume
          projections. Expand a row to see its step breakdown; use Select to reset a
          tool&apos;s recorded usage.
        </p>
        {toolTable}
      </div>

      {toastNode}
    </>
  );
}
