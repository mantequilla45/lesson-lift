"use client";

// ── Model routing ────────────────────────────────────────────────────────────
// Shared by /admin/usage and /admin/tools, which rendered the same
// admin_model_routing() result through near-identical markup that had already
// started to drift (different column labels, different footnote placement, one
// wrapped in a CardBody and one not).
//
// It stays on BOTH pages rather than being consolidated onto one, because it
// answers a different question in each place: on Usage it is "where is the
// money going", and on Tools it sits beside the per-tool model chips and
// answers "what is each tool routed to". Same data, two readings.

import { C, Card, CardFooter, CardHeader, CardTitle, EmptyState, Table, Tag, Td, Th, Tr } from "./ui";
import { gbpFromUsd, nf, penceFromUsd } from "./format";
import { cheapModelTone } from "@/app/lib/models";

export interface ModelRow {
  model: string;
  /** The reasoning_effort these runs used. NULL for gpt-4o, which has no such
   *  setting — the table groups by (model, effort), so one model can appear on
   *  several rows if its effort was changed during the month. That split is the
   *  point: it separates "we switched model" from "we raised effort". */
  effort: string | null;
  runs: number;
  total_tokens: number;
  /** Billed as OUTPUT and already counted inside total_tokens. Shown as a share
   *  so a gpt-5.6 row is not misread as if all its output were answer. */
  reasoning_tokens: number;
  /** gpt-5.6 explicit-cache writes, billed at 1.25x input. */
  cache_write_tokens: number;
  cost_usd: number;
  cost_per_run: number;
  tools: number;
  /** Month-to-date token_usage spend. Constant across rows. */
  text_total_usd: number;
  /** Month-to-date token_usage + asset_cost spend. Constant across rows. */
  all_in_total_usd: number;
}

export default function ModelRoutingCard({
  models,
  className,
}: {
  models: ModelRow[];
  className?: string;
}) {
  // Both totals are month constants repeated on every row, so any row will do.
  const textTotal = Number(models[0]?.text_total_usd ?? 0);
  const allInTotal = Number(models[0]?.all_in_total_usd ?? 0);
  // Images and audio are billed per unit and carry no model, so they cannot
  // appear in a table grouped by model. Only mention the gap when there is one.
  const hasAssetSpend = allInTotal > textTotal;

  // The effort and cache-write columns are dead weight while everything runs on
  // gpt-4o, which has neither. They appear only once a reasoning model has
  // actually run, so the card stays as simple as the data warrants.
  const anyReasoning = models.some((m) => m.effort !== null);
  const anyCacheWrites = models.some((m) => Number(m.cache_write_tokens) > 0);
  // Distinct models, not row count — one model split across two efforts is
  // still one model in use.
  const distinctModels = new Set(models.map((m) => m.model)).size;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Model routing</CardTitle>
        {models.length > 0 && (
          <Tag tone="ai">
            {distinctModels} model{distinctModels === 1 ? "" : "s"} in use
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
              {anyReasoning && <Th>Effort</Th>}
              <Th align="right">Runs</Th>
              <Th align="right">Tokens</Th>
              {anyCacheWrites && <Th align="right">Cache writes</Th>}
              <Th align="right">Cost / run</Th>
              <Th align="right">Cost this month</Th>
              <Th align="right">Tools</Th>
            </tr>
          </thead>
          <tbody>
            {models.map((m) => {
              const tokens = Number(m.total_tokens);
              const reasoning = Number(m.reasoning_tokens);
              // Share of ALL tokens, matching the number displayed directly
              // above it — a share of completion alone would be a larger,
              // unrelated percentage and invite misreading.
              const reasoningPct = tokens > 0 ? Math.round((reasoning / tokens) * 100) : 0;
              return (
              // Keyed on both: one model can now occupy several rows, one per
              // effort setting used this month.
              <Tr key={`${m.model}:${m.effort ?? "none"}`}>
                <Td>
                  <Tag tone={cheapModelTone(m.model)}>{m.model}</Tag>
                </Td>
                {anyReasoning && (
                  <Td>
                    {m.effort ? (
                      <span className="font-mono text-xs" style={{ color: C.ink2 }}>
                        {m.effort}
                      </span>
                    ) : (
                      // gpt-4o has no effort setting — not "unset", inapplicable.
                      <span className="text-xs" style={{ color: C.muted }}>
                        —
                      </span>
                    )}
                  </Td>
                )}
                <Td align="right" mono>
                  {nf.format(Number(m.runs))}
                </Td>
                <Td align="right" mono>
                  {nf.format(tokens)}
                  {reasoning > 0 && (
                    <div className="text-xs font-normal" style={{ color: C.muted }}>
                      {reasoningPct}% thinking
                    </div>
                  )}
                </Td>
                {anyCacheWrites && (
                  <Td align="right" mono>
                    {Number(m.cache_write_tokens) > 0
                      ? nf.format(Number(m.cache_write_tokens))
                      : "—"}
                  </Td>
                )}
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
              );
            })}
          </tbody>
        </Table>
      )}
      <CardFooter>
        {hasAssetSpend && (
          <>
            <b style={{ color: C.ink }}>Text generations only</b> — {gbpFromUsd(textTotal)} of{" "}
            {gbpFromUsd(allInTotal)} total AI spend this month. The remaining{" "}
            {gbpFromUsd(allInTotal - textTotal)} is images and audio, which are billed per unit
            and have no model to route.{" "}
          </>
        )}
        {anyReasoning && (
          <>
            One row per model <i>and effort</i>, so a cost change can be traced to whichever
            one moved. Thinking tokens are billed at the output rate and are already counted
            in Tokens.{" "}
          </>
        )}
        This is what actually ran. Change what a tool uses on the{" "}
        <b style={{ color: C.ink }}>Tools</b> page, which has a model dropdown per tool. Test
        quality on a handful before switching anything — a cheaper lesson plan a teacher
        doesn&apos;t trust costs far more than the saving.
      </CardFooter>
    </Card>
  );
}
