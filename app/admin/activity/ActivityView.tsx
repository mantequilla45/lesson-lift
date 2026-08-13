"use client";

import { downloadCsv, toCsv } from "@/app/lib/csv";
import { typeLabel } from "@/app/lib/toolRunDisplay";
import { fmtDateTime, nf } from "../format";
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
}

const EXPORT_HEADERS = ["When", "Tool", "Title", "User"];

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
                  lives on their account under People.
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
