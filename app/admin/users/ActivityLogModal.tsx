"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { createClient } from "@/app/lib/auth/client";
import { typeLabel, formatDate } from "@/app/lib/toolRunDisplay";
import { gbpFromUsd, nf } from "../format";

// The drawer shows the 10 most recent generations. This is the rest of them —
// paginated rather than fetched whole, because a teacher's history has no upper
// bound and the per-row cost figure is computed with a correlated subquery.

const PAGE = 50;

interface ActivityRow {
  id: string;
  tool_slug: string;
  title: string | null;
  created_at: string;
  approx_cost_usd: number;
  /** True when cost was joined by run_id rather than inferred from a time
   *  window — see the cost_run_id migration. */
  cost_is_exact: boolean;
  total_count: number;
}

export default function ActivityLogModal({
  userId,
  name,
  onClose,
}: {
  userId: string;
  name: string;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const supabase = createClient();
    (async () => {
      const { data, error: err } = await supabase.rpc("admin_teacher_activity", {
        uid: userId,
        lim: PAGE,
        off: page * PAGE,
      });
      if (cancelled) return;
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      const list = (data ?? []) as ActivityRow[];
      setRows(list);
      // total_count is repeated on every row; an empty page means no rows to
      // read it from, so keep whatever we already knew.
      if (list.length > 0) setTotal(Number(list[0].total_count));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, page]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const from = total === 0 ? 0 : page * PAGE + 1;
  const to = Math.min((page + 1) * PAGE, total);
  const lastPage = Math.max(0, Math.ceil(total / PAGE) - 1);

  return (
    <div className="fixed inset-0 z-1010 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-2xl rounded-2xl shadow-2xl border overflow-hidden flex flex-col max-h-[85vh]"
        style={{ borderColor: "#DAD8D0", backgroundColor: "#FAF9F5" }}
      >
        <div
          className="flex items-start gap-3 p-5 pb-4 border-b shrink-0"
          style={{ borderColor: "#DAD8D0" }}
        >
          <div className="flex-1 min-w-0">
            <h2 className="font-bold" style={{ color: "#1a1a1a" }}>
              Activity log
            </h2>
            <p className="text-sm mt-0.5 truncate" style={{ color: "#8a8078" }}>
              {name} · {nf.format(total)} generation{total === 1 ? "" : "s"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-black/5"
            style={{ color: "#8a8078" }}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {error ? (
            <p className="p-6 text-sm" style={{ color: "#B3261E" }}>
              {error}
            </p>
          ) : loading ? (
            <p className="p-6 text-sm" style={{ color: "#8a8078" }}>
              Loading…
            </p>
          ) : rows.length === 0 ? (
            <p className="p-6 text-sm" style={{ color: "#8a8078" }}>
              No generations yet.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: "#8a8078" }} className="text-left">
                  <th className="font-semibold px-5 py-2.5">Resource</th>
                  <th className="font-semibold px-5 py-2.5">Tool</th>
                  <th className="font-semibold px-5 py-2.5 text-right">Cost</th>
                  <th className="font-semibold px-5 py-2.5 text-right">When</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t" style={{ borderColor: "#EEECE4" }}>
                    <td className="px-5 py-2.5" style={{ color: "#1a1a1a" }}>
                      {r.title || typeLabel(r.tool_slug)}
                    </td>
                    <td className="px-5 py-2.5" style={{ color: "#6b6055" }}>
                      {typeLabel(r.tool_slug)}
                    </td>
                    <td
                      className="px-5 py-2.5 text-right font-mono text-xs"
                      style={{ color: "#6b6055" }}
                      title={
                        r.cost_is_exact
                          ? "Exact — every cost row for this generation"
                          : "Approximate — recorded before per-run cost tracking, matched by time"
                      }
                    >
                      {Number(r.approx_cost_usd) > 0
                        ? `${r.cost_is_exact ? "" : "~"}${gbpFromUsd(Number(r.approx_cost_usd))}`
                        : "—"}
                    </td>
                    <td className="px-5 py-2.5 text-right whitespace-nowrap" style={{ color: "#8a8078" }}>
                      {formatDate(r.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div
          className="flex items-center justify-between gap-2 p-4 border-t shrink-0"
          style={{ borderColor: "#DAD8D0" }}
        >
          <p className="text-xs" style={{ color: "#8a8078" }}>
            {total === 0 ? "Nothing to show" : `Showing ${nf.format(from)}–${nf.format(to)} of ${nf.format(total)}`}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
              className="text-sm font-semibold rounded-xl border px-3 py-1.5 transition-colors hover:bg-black/5 disabled:opacity-40"
              style={{ borderColor: "#DAD8D0", color: "#1a1a1a" }}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
              disabled={page >= lastPage || loading}
              className="text-sm font-semibold rounded-xl border px-3 py-1.5 transition-colors hover:bg-black/5 disabled:opacity-40"
              style={{ borderColor: "#DAD8D0", color: "#1a1a1a" }}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
