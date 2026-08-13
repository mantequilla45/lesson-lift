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

export interface ModelRow {
  model: string;
  runs: number;
  total_tokens: number;
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

  return (
    <Card className={className}>
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
        {hasAssetSpend && (
          <>
            <b style={{ color: C.ink }}>Text generations only</b> — {gbpFromUsd(textTotal)} of{" "}
            {gbpFromUsd(allInTotal)} total AI spend this month. The remaining{" "}
            {gbpFromUsd(allInTotal - textTotal)} is images and audio, which are billed per unit
            and have no model to route.{" "}
          </>
        )}
        Routing is decided in each tool&apos;s API route, not here. Test quality on a handful
        before switching anything — a cheaper lesson plan a teacher doesn&apos;t trust costs far
        more than the saving.
      </CardFooter>
    </Card>
  );
}
