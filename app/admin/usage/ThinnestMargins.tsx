"use client";

import { marginTone } from "@/app/lib/costs";
import { gbp, gbpFromUsd, nf } from "../format";
import {
  BypassTag,
  C,
  Card,
  CardFooter,
  CardHeader,
  CardTitle,
  EmptyState,
  Table,
  Tag,
  Td,
  Th,
  Tr,
} from "../ui";

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

/**
 * Who costs more than they pay. This is the panel that protects unit economics:
 * AI-image slideshows cost ~33x a text resource, so a single heavy user on a
 * cheap plan can go underwater without anything else looking wrong.
 *
 * Free teachers have no revenue to divide by, so they show cost only — they are
 * a marketing expense, not a margin problem.
 */
export default function ThinnestMargins({ rows }: { rows: MarginRow[] }) {
  // Admins are excluded: they bypass the cap by design, so their cost is
  // internal usage rather than a margin problem to act on.
  const underwater = rows.filter(
    (r) => !r.is_admin && r.margin_pct !== null && Number(r.contribution_gbp) < 0,
  ).length;
  const admins = rows.filter((r) => r.is_admin).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Thinnest margins</CardTitle>
        {underwater > 0 ? (
          <Tag tone="danger">{nf.format(underwater)} losing money</Tag>
        ) : (
          <Tag tone="warn">watch these</Tag>
        )}
      </CardHeader>

      {rows.length === 0 ? (
        <EmptyState
          title="Nobody has generated anything this month"
          body="Once teachers start using tools, whoever costs the most against what they pay appears here."
        />
      ) : (
        <Table>
          <thead>
            <tr className="text-left">
              <Th>Teacher</Th>
              <Th>Plan</Th>
              <Th align="right">Pays</Th>
              <Th align="right">Costs us</Th>
              <Th align="right">Contribution</Th>
              <Th align="right">Margin</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const margin = r.margin_pct === null ? null : Number(r.margin_pct);
              const tone = marginTone(margin);
              const contribution = Number(r.contribution_gbp);
              return (
                <Tr key={r.user_id}>
                  <Td>
                    <div className="flex items-center gap-2">
                      <span className="font-medium" style={{ color: C.ink }}>
                        {r.teacher}
                      </span>
                      {r.is_admin && <BypassTag compact />}
                    </div>
                    <div className="text-xs" style={{ color: C.muted }}>
                      {nf.format(Number(r.generations))} generation
                      {Number(r.generations) === 1 ? "" : "s"}
                      {Number(r.ai_images) > 0 && (
                        <span style={{ color: C.img }}>
                          {" "}
                          · {nf.format(Number(r.ai_images))} AI image
                          {Number(r.ai_images) === 1 ? "" : "s"}
                        </span>
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
                    <span
                      className="tabular-nums font-semibold"
                      style={{
                        color: r.is_admin ? C.muted : contribution < 0 ? C.danger : C.ink,
                      }}
                    >
                      {gbp(contribution)}
                    </span>
                  </Td>
                  <Td align="right">
                    {r.is_admin ? (
                      <Tag title="Internal usage — not a paying account">internal</Tag>
                    ) : margin === null ? (
                      <Tag>free plan</Tag>
                    ) : (
                      <Tag tone={tone}>{Math.round(margin * 100)}%</Tag>
                    )}
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      )}

      <CardFooter>
        <span>
          Contribution is what they pay less measured AI cost, before card fees and overheads.
          Anyone red should be offered a higher plan or an AI top-up, not left alone. Free
          teachers show cost only — they are acquisition spend, not a margin problem.
          {admins > 0 && (
            <>
              {" "}
              {nf.format(admins)} admin account{admins === 1 ? "" : "s"} shown as{" "}
              <b>internal</b>: admins bypass the generation cap, so their cost is internal
              usage and is excluded from the losing-money count.
            </>
          )}
        </span>
      </CardFooter>
    </Card>
  );
}
