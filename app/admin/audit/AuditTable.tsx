"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/app/lib/auth/client";
import { downloadCsv, toCsv } from "@/app/lib/csv";
import { fmtDateTime, nf } from "../format";
import {
  Btn,
  C,
  Card,
  CardFooter,
  EmptyState,
  FilterBar,
  PageHead,
  Table,
  Tag,
  Td,
  Th,
  Tr,
  inputClass,
  inputStyle,
  useToast,
} from "../ui";

// `ip` is deliberately absent: admin_log() is a security-definer function with
// no access to the request, so the column has been null on every row ever
// written. A column of dashes on the page you show a DPO is worse than no
// column at all.
export interface AuditRow {
  id: string;
  actor_email: string | null;
  action: string;
  action_type: string;
  object_type: string | null;
  object_id: string | null;
  object_label: string | null;
  detail: Record<string, unknown>;
  created_at: string;
  total_count: number;
}

export interface ActorRow {
  actor_email: string;
  entries: number;
}

const TYPES = [
  { value: "", label: "All actions" },
  { value: "account", label: "Account changes" },
  { value: "billing", label: "Billing" },
  { value: "content", label: "Content" },
  { value: "access", label: "Access" },
  { value: "other", label: "Other" },
];

const PAGE = 100;
/** Rows per request when building an export. Larger than PAGE because nobody
 *  is waiting on a render, and it keeps a year of activity to a few calls. */
const EXPORT_PAGE = 1000;
/** Ceiling on an export, so a filter that matches everything can't try to pull
 *  an unbounded table into the browser. */
const EXPORT_MAX = 10_000;

const EXPORT_HEADERS = [
  "When",
  "Who",
  "Action",
  "Type",
  "Object",
  "Object ID",
  "Detail",
];

export default function AuditTable({
  initialRows,
  actors,
}: {
  initialRows: AuditRow[];
  actors: ActorRow[];
}) {
  const [rows, setRows] = useState(initialRows);
  const [q, setQ] = useState("");
  const [actor, setActor] = useState("");
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(false);
  const [more, setMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toastNode, fire] = useToast();

  // Filtering happens in Postgres rather than in the browser: the audit log is
  // append-only and unbounded, so it can't be pulled down wholesale the way the
  // teachers table is. Debounced so typing doesn't fire a query per keystroke.
  useEffect(() => {
    let cancelled = false;
    const t = window.setTimeout(async () => {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase.rpc("admin_audit_log_list", {
        q: q || null,
        actor: actor || null,
        p_type: type || null,
        lim: PAGE,
        off: 0,
      });
      if (cancelled) return;
      setRows((data ?? []) as AuditRow[]);
      setLoading(false);
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [q, actor, type]);

  const total = rows[0]?.total_count ?? 0;

  const loadMore = async () => {
    setMore(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("admin_audit_log_list", {
      q: q || null,
      actor: actor || null,
      p_type: type || null,
      lim: PAGE,
      off: rows.length,
    });
    setMore(false);
    if (error) {
      fire(error.message);
      return;
    }
    setRows((prev) => [...prev, ...((data ?? []) as AuditRow[])]);
  };

  // Exports everything the current filters match, not just what's been loaded
  // — an export that silently stopped at the first 100 would be worse than
  // none on a page whose whole promise is completeness. Pages server-side
  // because the log is append-only and unbounded.
  const exportCsv = async () => {
    setExporting(true);
    const supabase = createClient();
    const all: AuditRow[] = [];

    while (all.length < EXPORT_MAX) {
      const { data, error } = await supabase.rpc("admin_audit_log_list", {
        q: q || null,
        actor: actor || null,
        p_type: type || null,
        lim: EXPORT_PAGE,
        off: all.length,
      });
      if (error) {
        setExporting(false);
        fire(error.message);
        return;
      }
      const page = (data ?? []) as AuditRow[];
      all.push(...page);
      if (page.length < EXPORT_PAGE) break;
    }

    downloadCsv(
      toCsv(
        EXPORT_HEADERS,
        all.map((r) => [
          fmtDateTime(r.created_at),
          r.actor_email ?? "system",
          r.action,
          r.action_type,
          r.object_label ?? "",
          r.object_id ?? "",
          // The field that actually answers "what changed" — fetched and
          // thrown away by the table, but the reason a DPO asked for a file.
          Object.keys(r.detail ?? {}).length ? JSON.stringify(r.detail) : "",
        ]),
      ),
      `jooma-audit-${new Date().toISOString().slice(0, 10)}.csv`,
    );

    setExporting(false);
    fire(
      all.length >= EXPORT_MAX
        ? `Exported the most recent ${nf.format(EXPORT_MAX)} entries — narrow the filters for the rest.`
        : `Exported ${nf.format(all.length)} ${all.length === 1 ? "entry" : "entries"}.`,
    );
  };

  return (
    <>
      <PageHead
        title="Audit log"
        sub="Every admin action, permanently. This is what you show a school's data protection officer when they ask."
      >
        <Btn onClick={exportCsv} disabled={exporting || total === 0}>
          {exporting ? "Exporting…" : "Export"}
        </Btn>
      </PageHead>

      <Card>
        <FilterBar>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search actions, users or IDs"
            className={inputClass}
            style={{ ...inputStyle, minWidth: 240 }}
          />
          <select
            value={actor}
            onChange={(e) => setActor(e.target.value)}
            className={inputClass}
            style={inputStyle}
          >
            <option value="">Everyone</option>
            {actors.map((a) => (
              <option key={a.actor_email} value={a.actor_email}>
                {a.actor_email} ({nf.format(a.entries)})
              </option>
            ))}
          </select>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className={inputClass}
            style={inputStyle}
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <div className="flex-1" />
          {loading && (
            <span className="text-xs" style={{ color: C.muted }}>
              Loading…
            </span>
          )}
          <Tag>{nf.format(total)} entries</Tag>
        </FilterBar>

        {rows.length === 0 ? (
          <EmptyState
            title={q || actor || type ? "No entries match that" : "Nothing logged yet"}
            body={
              q || actor || type
                ? "Try clearing a filter."
                : "Admin actions are recorded here as they happen — grants, plan changes, refunds and suspensions."
            }
          />
        ) : (
          <Table>
            <thead>
              <tr className="text-left">
                <Th width="160px">When</Th>
                <Th width="180px">Who</Th>
                <Th>Action</Th>
                <Th>Object</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Tr key={r.id}>
                  <Td>
                    <span className="text-xs" style={{ color: C.ink2 }}>
                      {fmtDateTime(r.created_at)}
                    </span>
                  </Td>
                  <Td>
                    <span className="font-medium" style={{ color: C.ink }}>
                      {r.actor_email ?? "system"}
                    </span>
                  </Td>
                  <Td>
                    <span style={{ color: C.ink }}>{r.action}</span>
                  </Td>
                  <Td>
                    {r.object_label ? (
                      <span style={{ color: C.ink2 }}>
                        {r.object_label}
                        {r.object_id && (
                          <span className="font-mono text-xs ml-1.5" style={{ color: C.muted }}>
                            {r.object_id.slice(0, 8)}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span style={{ color: C.muted }}>—</span>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}

        <CardFooter>
          <div className="flex items-center gap-3 flex-wrap">
            <span>Append-only. Not editable by anyone, including super admins.</span>
            {rows.length < total && (
              <>
                <span>
                  Showing {nf.format(rows.length)} of {nf.format(total)}.
                </span>
                <Btn size="sm" onClick={loadMore} disabled={more}>
                  {more ? "Loading…" : "Load more"}
                </Btn>
              </>
            )}
          </div>
        </CardFooter>
      </Card>

      {toastNode}
    </>
  );
}
