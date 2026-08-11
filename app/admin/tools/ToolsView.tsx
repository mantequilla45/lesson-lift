"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/auth/client";
import { PLANS } from "@/app/lib/plans";
import { fmtRelative, gbpFromUsd, nf, penceFromUsd } from "../format";
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

export interface ModelRow {
  model: string;
  runs: number;
  total_tokens: number;
  cost_usd: number;
  cost_per_run: number;
  tools: number;
}

const ALL_PLANS = Object.values(PLANS).map((p) => p.id);

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
                          <Tag tone="danger">nobody</Tag>
                        ) : t.plans.length === ALL_PLANS.length ? (
                          <Tag>all plans</Tag>
                        ) : (
                          t.plans.map((p) => (
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

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Model routing</CardTitle>
        </CardHeader>
        <CardBody>
          {models.length === 0 ? (
            <p className="text-sm" style={{ color: C.muted }}>
              No generations recorded this month.
            </p>
          ) : (
            <>
              <Table>
                <thead>
                  <tr className="text-left">
                    <Th>Model</Th>
                    <Th align="right">Runs</Th>
                    <Th align="right">Tokens</Th>
                    <Th align="right">Cost / run</Th>
                    <Th align="right">Cost this month</Th>
                    <Th align="right">Tools using it</Th>
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
              <p className="text-xs mt-3" style={{ color: C.muted }}>
                Routing is decided in each tool&apos;s API route, not here — the note on a tool
                records intent for review. Test quality on a handful before switching anything:
                a cheaper lesson plan a teacher doesn&apos;t trust costs far more than the
                saving.
              </p>
            </>
          )}
        </CardBody>
      </Card>

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

      <Field label="Available to" help="Unticking every plan makes the tool unreachable.">
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
        <Note tone="danger">
          No plans selected — this tool will be unavailable to everyone.
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
            Turning a tool off hides it and stops new generations.
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
