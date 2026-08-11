"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/app/lib/auth/client";
import { fmtDateTime, nf } from "../format";
import {
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
} from "../ui";

export interface AuditRow {
  id: string;
  actor_email: string | null;
  action: string;
  action_type: string;
  object_type: string | null;
  object_id: string | null;
  object_label: string | null;
  detail: Record<string, unknown>;
  ip: string | null;
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

  return (
    <>
      <PageHead
        title="Audit log"
        sub="Every admin action, permanently. This is what you show a school's data protection officer when they ask."
      />

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
                <Th width="120px">IP</Th>
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
                  <Td>
                    <span className="font-mono text-xs" style={{ color: C.muted }}>
                      {r.ip ?? "—"}
                    </span>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}

        <CardFooter>
          Append-only. Not editable by anyone, including super admins.
          {rows.length >= PAGE && ` Showing the most recent ${nf.format(PAGE)}.`}
        </CardFooter>
      </Card>
    </>
  );
}
