"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/auth/client";
import { SELECTABLE_PLANS } from "@/app/lib/plans";
import { fmtRelative, gbpFromUsd, nf, penceFromUsd } from "../format";
import ModelRoutingCard, { type ModelRow } from "../ModelRoutingCard";
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
  Stat,
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

export interface ToolRow {
  slug: string;
  display_name: string;
  enabled: boolean;
  plans: string[];
  model_note: string | null;
  runs: number;
  total_tokens: number;
  cost_usd: number;
  cost_per_run: number;
  avg_tokens: number;
  models: string[];
  last_used: string | null;
}

export type { ModelRow };

// Only the plans that can actually be sold — free and pro. `max` is retired
// (no Stripe price) and `school` is unbuilt (no seats, no pooled allowances),
// so offering either here would let an admin scope a tool to a plan nobody can
// be on. SELECTABLE_PLANS is the same filter the teacher-facing plan pickers
// use, so the two cannot drift.
// Widened to string[] deliberately: tool_settings.plans is a free text[] in the
// database and can hold values outside the PlanId union (the seed still lists
// 'max' and 'school'), so comparisons against it must not assume otherwise.
const ALL_PLANS: string[] = SELECTABLE_PLANS.map((p) => p.id);

export default function ToolsView({
  rows,
  models,
  listedSlugs,
}: {
  rows: ToolRow[];
  models: ModelRow[];
  listedSlugs: string[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [state, setState] = useState("");
  const [editing, setEditing] = useState<ToolRow | null>(null);
  const [toastNode, fire] = useToast();

  const listed = useMemo(() => new Set(listedSlugs), [listedSlugs]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((t) => {
      if (needle && !`${t.display_name} ${t.slug}`.toLowerCase().includes(needle)) return false;
      if (planFilter && !t.plans.includes(planFilter)) return false;
      if (state === "on" && !t.enabled) return false;
      if (state === "off" && t.enabled) return false;
      if (state === "unlisted" && listed.has(t.slug)) return false;
      if (state === "used" && Number(t.runs) === 0) return false;
      return true;
    });
  }, [rows, q, planFilter, state, listed]);

  const totalCost = rows.reduce((a, t) => a + Number(t.cost_usd), 0);
  const totalRuns = rows.reduce((a, t) => a + Number(t.runs), 0);
  const disabled = rows.filter((t) => !t.enabled).length;
  const unlisted = rows.filter((t) => !listed.has(t.slug)).length;

  const toggleTool = async (slug: string, enabled: boolean, name: string) => {
    const supabase = createClient();
    const { error } = await supabase.rpc("admin_update_tool", {
      p_slug: slug,
      payload: { enabled },
    });
    if (error) {
      fire(error.message);
      return;
    }
    fire(`${name} ${enabled ? "enabled" : "turned off"}.`);
    router.refresh();
  };

  return (
    <>
      <PageHead
        title="Tools"
        sub={`All ${nf.format(rows.length)}, with their measured cost this month. Turn one off or change who gets it — without a deploy.`}
      />

      <div className="grid gap-3.5 mb-6 grid-cols-2 lg:grid-cols-4">
        <Stat label="Tools configured" value={nf.format(rows.length)} foot={`${disabled} turned off`} />
        <Stat label="Runs this month" value={nf.format(totalRuns)} foot="across all tools" />
        <Stat
          label="Measured cost"
          value={gbpFromUsd(totalCost)}
          foot="this month, from logged usage"
        />
        <Stat
          label="Cost per run"
          value={totalRuns > 0 ? penceFromUsd(totalCost / totalRuns) : "—"}
          foot="blended average"
        />
      </div>

      {unlisted > 0 && (
        <div className="mb-4">
          <Note tone="warn">
            <b>
              {nf.format(unlisted)} tool{unlisted === 1 ? "" : "s"} not in the teacher-facing
              list.
            </b>{" "}
            The route exists and can record cost, but it doesn&apos;t appear in the tool grid —
            so nobody can find it, and nobody is watching it. Filter to{" "}
            <i>Not listed to teachers</i> to see which.
          </Note>
        </div>
      )}

      <Card>
        <FilterBar>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tool name or slug"
            className={inputClass}
            style={{ ...inputStyle, minWidth: 220 }}
          />
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className={inputClass}
            style={inputStyle}
          >
            <option value="">All plans</option>
            {ALL_PLANS.map((p) => (
              <option key={p} value={p}>
                Available on {p}
              </option>
            ))}
          </select>
          <select
            value={state}
            onChange={(e) => setState(e.target.value)}
            className={inputClass}
            style={inputStyle}
          >
            <option value="">Any state</option>
            <option value="on">Enabled</option>
            <option value="off">Turned off</option>
            <option value="used">Used this month</option>
            <option value="unlisted">Not listed to teachers</option>
          </select>
          <div className="flex-1" />
          <Tag>{nf.format(filtered.length)} shown</Tag>
        </FilterBar>

        {filtered.length === 0 ? (
          <EmptyState title="No tools match that" body="Try clearing a filter." />
        ) : (
          <Table>
            <thead>
              <tr className="text-left">
                <Th>Tool</Th>
                <Th align="right">Cost / run</Th>
                <Th align="right">Avg tokens</Th>
                <Th align="right">Runs</Th>
                <Th align="right">Cost this month</Th>
                <Th>Model</Th>
                <Th>Plans</Th>
                <Th align="center">Live</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const perRun = Number(t.cost_per_run);
                // Anything an order of magnitude above the blended average is
                // worth a second look — that's where margin goes.
                const expensive = perRun > 0.03;
                return (
                  <Tr key={t.slug}>
                    <Td>
                      <button
                        type="button"
                        className="text-left"
                        onClick={() => setEditing(t)}
                      >
                        <div className="font-semibold hover:underline" style={{ color: C.ink }}>
                          {t.display_name}
                        </div>
                        <div className="font-mono text-xs" style={{ color: C.muted }}>
                          {t.slug}
                          {!listed.has(t.slug) && (
                            <span style={{ color: C.warn }}> · not listed</span>
                          )}
                        </div>
                      </button>
                    </Td>
                    <Td align="right">
                      <span
                        className="tabular-nums font-semibold"
                        style={{ color: expensive ? C.img : C.ink }}
                      >
                        {perRun > 0 ? penceFromUsd(perRun) : "—"}
                      </span>
                    </Td>
                    <Td align="right">
                      <span className="tabular-nums" style={{ color: C.ink2 }}>
                        {Number(t.avg_tokens) > 0 ? nf.format(Number(t.avg_tokens)) : "—"}
                      </span>
                    </Td>
                    <Td align="right" mono>
                      {nf.format(Number(t.runs))}
                    </Td>
                    <Td align="right" mono>
                      {Number(t.cost_usd) > 0 ? gbpFromUsd(Number(t.cost_usd)) : "—"}
                    </Td>
                    <Td>
                      {t.models.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {t.models.map((m) => (
                            <Tag key={m} tone={m.includes("mini") ? "ok" : "plain"}>
                              {m}
                            </Tag>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs" style={{ color: C.muted }}>
                          not run yet
                        </span>
                      )}
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {t.plans.length === 0 ? (
                          <Tag
                            tone="warn"
                            title="Recorded only — plan restrictions are not enforced. The tool is still available to everyone."
                          >
                            nobody
                          </Tag>
                        ) : ALL_PLANS.every((p) => t.plans.includes(p)) ? (
                          // Covers every SELLABLE plan — tested by coverage, not
                          // by count. The seeded rows still list retired/unbuilt
                          // plans too, so comparing lengths would never match.
                          <Tag>all plans</Tag>
                        ) : (
                          // Only show plans that can actually be sold; a
                          // lingering 'max'/'school' entry is noise, not a
                          // restriction anyone can act on.
                          t.plans
                            .filter((p) => ALL_PLANS.includes(p))
                            .map((p) => (
                              <Tag key={p} tone={p === "free" ? "plain" : "brand"}>
                                {p}
                              </Tag>
                            ))
                        )}
                      </div>
                    </Td>
                    <Td align="center">
                      <div className="flex justify-center">
                        <Toggle
                          on={t.enabled}
                          onChange={(next) => toggleTool(t.slug, next, t.display_name)}
                          label={t.display_name}
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
          {nf.format(rows.length)} tools · {gbpFromUsd(totalCost)} measured this month · costs
          read from token_usage and asset_cost, not estimated
        </CardFooter>
      </Card>

      <ModelRoutingCard models={models} className="mt-4" />

      {editing && (
        <EditToolModal
          tool={editing}
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

function EditToolModal({
  tool,
  onClose,
  onSaved,
}: {
  tool: ToolRow;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [plans, setPlans] = useState<string[]>(tool.plans);
  const [enabled, setEnabled] = useState(tool.enabled);
  const [modelNote, setModelNote] = useState(tool.model_note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only the sellable plans get a button, but `plans` is seeded from the row as
  // it is — so any lingering 'max'/'school' entry is carried through a save
  // untouched rather than being silently dropped by an edit that never showed
  // it. Don't "simplify" this to rebuild the array from ALL_PLANS.
  const togglePlan = (plan: string) =>
    setPlans((prev) =>
      prev.includes(plan) ? prev.filter((p) => p !== plan) : [...prev, plan],
    );

  const submit = async () => {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: e } = await supabase.rpc("admin_update_tool", {
      p_slug: tool.slug,
      payload: { enabled, plans, model_note: modelNote },
    });
    setSaving(false);
    if (e) {
      setError(e.message);
      return;
    }
    onSaved(`${tool.display_name} saved.`);
    onClose();
  };

  return (
    <Modal
      title={tool.display_name}
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={submit} disabled={saving}>
            {saving ? "Saving…" : "Save tool"}
          </Btn>
        </>
      }
    >
      <div
        className="rounded-xl border px-3.5 py-3 mb-4 text-sm"
        style={{ borderColor: C.border, backgroundColor: C.white }}
      >
        {[
          ["Slug", tool.slug],
          ["Runs this month", nf.format(Number(tool.runs))],
          [
            "Cost per run",
            Number(tool.cost_per_run) > 0 ? penceFromUsd(Number(tool.cost_per_run)) : "—",
          ],
          ["Last used", fmtRelative(tool.last_used)],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between py-0.5">
            <span style={{ color: C.muted }}>{k}</span>
            <span className="font-mono text-xs" style={{ color: C.ink }}>
              {v}
            </span>
          </div>
        ))}
      </div>

      <Field
        label="Available to"
        help="Recorded for review — plan restrictions are NOT enforced yet. Use the Enabled switch below to actually stop a tool."
      >
        <div className="flex flex-wrap gap-2">
          {ALL_PLANS.map((p) => {
            const on = plans.includes(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => togglePlan(p)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors capitalize"
                style={
                  on
                    ? { backgroundColor: C.ink, borderColor: C.ink, color: "#fff" }
                    : { backgroundColor: "transparent", borderColor: C.border, color: C.muted }
                }
              >
                {p}
              </button>
            );
          })}
        </div>
      </Field>

      {plans.length === 0 && (
        <Note tone="warn">
          No plans selected. This is recorded but not enforced — the tool stays available to
          everyone until you switch it off below.
        </Note>
      )}

      <div className="mt-3">
        <Field
          label="Model note"
          help="Free text for review. Routing is decided in the tool's API route; this doesn't change it."
        >
          <input
            value={modelNote}
            onChange={(e) => setModelNote(e.target.value)}
            placeholder="e.g. Candidate for gpt-4o-mini — short structured output"
            className={fieldClass}
            style={fieldStyle}
          />
        </Field>
      </div>

      <div
        className="flex items-center gap-3 py-3 border-t mt-1"
        style={{ borderColor: C.divider }}
      >
        <div className="flex-1">
          <div className="text-sm font-medium" style={{ color: C.ink }}>
            Enabled
          </div>
          <div className="text-xs" style={{ color: C.muted }}>
            Removes it from the teacher tool grid, blocks the tool page, and refuses new
            generations at the API. Takes effect within a minute.
          </div>
        </div>
        <Toggle on={enabled} onChange={setEnabled} label="Enabled" />
      </div>

      {error && (
        <p className="text-sm mt-2" style={{ color: C.danger }}>
          {error}
        </p>
      )}
    </Modal>
  );
}
