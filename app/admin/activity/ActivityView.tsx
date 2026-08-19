"use client";

import { downloadCsv, toCsv } from "@/app/lib/csv";
import { typeLabel } from "@/app/lib/toolRunDisplay";
import { cheapModelTone } from "@/app/lib/models";
import { fmtDateTime, nf, penceFromUsd } from "../format";
import {
  Btn,
  C,
  Card,
  CardFooter,
  EmptyState,
  PageHead,
  Table,
  Tag,
  Td,
  Th,
  Tr,
  useToast,
} from "../ui";

export interface RunRow {
  id: string;
  email: string | null;
  tool_slug: string;
  title: string | null;
  created_at: string;
  /** Every model this run used. A slideshow fans out to several sub-routes, so
   *  one run can legitimately span more than one. */
  models: string[];
  cost_usd: number;
  /** False when the cost was matched by a ±1 minute timestamp window rather
   *  than a run_id — true for runs recorded before run_id existed. Surfaced
   *  rather than hidden, so an approximation is never read as precise. */
  cost_is_exact: boolean;
}

const EXPORT_HEADERS = ["When", "Tool", "Title", "User", "Model", "Cost (USD)", "Cost exact"];

export default function ActivityView({ rows }: { rows: RunRow[] }) {
  const [toastNode, fire] = useToast();

  // Everything on screen is already loaded, so this needs no second query —
  // same approach as the teachers export.
  const exportCsv = () => {
    downloadCsv(
      toCsv(
        EXPORT_HEADERS,
        rows.map((r) => [
          fmtDateTime(r.created_at),
          typeLabel(r.tool_slug),
          r.title ?? "",
          r.email ?? "",
          (r.models ?? []).join(" + "),
          // Raw USD, not the pence-formatted display string: an export is for
          // spreadsheets, which need a number they can sum.
          Number(r.cost_usd ?? 0).toFixed(6),
          r.cost_is_exact ? "yes" : "approx",
        ]),
      ),
      `jooma-activity-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    fire(`Exported ${nf.format(rows.length)} ${rows.length === 1 ? "run" : "runs"}.`);
  };

  return (
    <>
      <PageHead
        title="Activity"
        sub="The 100 most recent generations across all users."
      >
        <Btn onClick={exportCsv} disabled={rows.length === 0}>
          Export
        </Btn>
      </PageHead>

      <Card>
        {rows.length === 0 ? (
          <EmptyState
            title="No activity yet"
            body="Generations appear here as teachers make them."
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr className="text-left">
                  <Th>Tool</Th>
                  <Th>Title</Th>
                  <Th>User</Th>
                  <Th>Model</Th>
                  <Th align="right">Cost</Th>
                  <Th align="right">When</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Tr key={r.id}>
                    <Td>
                      <span className="font-medium" style={{ color: C.ink }}>
                        {typeLabel(r.tool_slug)}
                      </span>
                    </Td>
                    <Td>
                      <span className="block max-w-xs truncate" style={{ color: C.ink2 }}>
                        {r.title || "—"}
                      </span>
                    </Td>
                    <Td>
                      <span style={{ color: C.ink2 }}>{r.email || "—"}</span>
                    </Td>
                    <Td>
                      {(r.models ?? []).length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {r.models.map((m) => (
                            <Tag key={m} tone={cheapModelTone(m)}>
                              {m}
                            </Tag>
                          ))}
                        </div>
                      ) : (
                        // No token_usage matched this run — an image-only run,
                        // or one whose telemetry never landed.
                        <span className="text-xs" style={{ color: C.muted }}>
                          —
                        </span>
                      )}
                    </Td>
                    <Td align="right" mono>
                      {Number(r.cost_usd) > 0 ? (
                        <>
                          {penceFromUsd(Number(r.cost_usd))}
                          {!r.cost_is_exact && (
                            <span
                              title="Matched to this run by timestamp, not run id — approximate."
                              style={{ color: C.muted }}
                            >
                              {" "}
                              ~
                            </span>
                          )}
                        </>
                      ) : (
                        <span style={{ color: C.muted }}>—</span>
                      )}
                    </Td>
                    <Td align="right">
                      <span className="text-xs whitespace-nowrap" style={{ color: C.muted }}>
                        {fmtDateTime(r.created_at)}
                      </span>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <CardFooter>
              <div className="flex items-center gap-2 flex-wrap">
                <Tag>{nf.format(rows.length)} shown</Tag>
                <span>
                  Every generation across the platform, newest first. Per-teacher history
                  lives on their account under People. A <b style={{ color: C.ink }}>~</b> on a
                  cost means it was matched to the run by timestamp rather than run id, so it
                  is approximate.
                </span>
              </div>
            </CardFooter>
          </>
        )}
      </Card>

      {toastNode}
    </>
  );
}
