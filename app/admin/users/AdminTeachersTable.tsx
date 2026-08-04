"use client";

import { useMemo, useState } from "react";
import { PLANS, asPlanId } from "@/app/lib/plans";
import { nf, usd } from "../format";

export interface TeacherRow {
  id: string;
  email: string;
  first_name: string | null;
  surname: string | null;
  plan: string | null;
  subscription_status: string | null;
  is_admin: boolean;
  created_at: string;
  generations: number;
  generations_this_month: number;
  cost_usd: number;
}

const PLAN_STYLE: Record<string, { bg: string; color: string }> = {
  free: { bg: "#EEECE4", color: "#8a8078" },
  pro: { bg: "#DDF0E2", color: "#1f6b3b" },
  school: { bg: "#E2E8F5", color: "#2a4a8a" },
};

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  active: { bg: "#DDF0E2", color: "#1f6b3b" },
  trialing: { bg: "#E2E8F5", color: "#2a4a8a" },
  past_due: { bg: "#FBECEB", color: "#B3261E" },
  canceled: { bg: "#EEECE4", color: "#8a8078" },
};

const STATUS_OPTIONS = ["active", "trialing", "past_due", "canceled"];

/** Resources this month, as a "used / cap" string. Free is capped by
 *  plans.ts (currently 5/month); Pro and School are unlimited today, so
 *  there's nothing to show against — just the raw count used. */
function resourcesLabel(plan: string, usedThisMonth: number): string {
  const limit = PLANS[asPlanId(plan)].limits.monthlyGenerations;
  if (limit === null) return `${nf.format(usedThisMonth)} used`;
  return `${nf.format(usedThisMonth)} / ${nf.format(limit)}`;
}

/** Monthly revenue for this teacher — list price of their plan. There's no
 *  billing-interval column yet to distinguish monthly vs. annual seats, so
 *  this uses the plan's flat monthly price, same as Free contributing £0. */
function monthlyRevenue(plan: string): number {
  return PLANS[asPlanId(plan)].priceMonthly ?? 0;
}

/** Margin = (revenue - AI cost this month) / revenue. Free teachers have no
 *  revenue to divide by, so they show cost only, same as the spec. */
function marginPct(plan: string, costUsd: number): number | null {
  const revenue = monthlyRevenue(plan);
  if (revenue <= 0) return null;
  return (revenue - costUsd) / revenue;
}

export default function AdminTeachersTable({ rows }: { rows: TeacherRow[] }) {
  const [q, setQ] = useState("");
  const [plan, setPlan] = useState("");
  const [status, setStatus] = useState("");
  const [margin, setMargin] = useState("");
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((u) => {
      if (needle) {
        const name = [u.first_name, u.surname].filter(Boolean).join(" ");
        const hay = `${name} ${u.email} ${u.id}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (plan && (u.plan ?? "free") !== plan) return false;
      if (status && (u.subscription_status ?? "") !== status) return false;
      if (margin) {
        const m = marginPct(u.plan ?? "free", Number(u.cost_usd));
        if (margin === "low" && !(m !== null && m < 0.35)) return false;
        if (margin === "neg" && !(m !== null && m < 0)) return false;
      }
      return true;
    });
  }, [rows, q, plan, status, margin]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allSelected = filtered.length > 0 && filtered.every((u) => selected.has(u.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(filtered.map((u) => u.id)));

  const exitSelect = () => {
    setSelecting(false);
    setSelected(new Set());
  };

  const clearFilters = () => {
    setQ("");
    setPlan("");
    setStatus("");
    setMargin("");
  };

  const hasFilters = q || plan || status || margin;

  const selectStyle: React.CSSProperties = {
    borderColor: "#DAD8D0",
    backgroundColor: "#fff",
    color: "#1a1a1a",
  };

  return (
    <>
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ backgroundColor: "#FAF9F5", borderColor: "#DAD8D0" }}
      >
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "#EEECE4" }}>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, email or user ID"
            className="text-sm rounded-lg border px-3 py-1.5 min-w-[220px]"
            style={selectStyle}
          />
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            className="text-sm rounded-lg border px-3 py-1.5"
            style={selectStyle}
          >
            <option value="">All plans</option>
            {Object.values(PLANS).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="text-sm rounded-lg border px-3 py-1.5"
            style={selectStyle}
          >
            <option value="">Any status</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
          <select
            disabled
            title="No school data yet"
            className="text-sm rounded-lg border px-3 py-1.5 opacity-50 cursor-not-allowed"
            style={selectStyle}
          >
            <option>Any school</option>
          </select>
          <select
            value={margin}
            onChange={(e) => setMargin(e.target.value)}
            className="text-sm rounded-lg border px-3 py-1.5"
            style={selectStyle}
          >
            <option value="">Any margin</option>
            <option value="low">Margin under 35%</option>
            <option value="neg">Losing money</option>
          </select>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm font-semibold rounded-lg px-3 py-1.5 transition-colors hover:bg-black/5"
              style={{ color: "#8a8078" }}
            >
              Clear
            </button>
          )}

          <div className="flex-1" />

          <span
            className="text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap"
            style={{ backgroundColor: "#EEECE4", color: "#8a8078" }}
          >
            {nf.format(filtered.length)} shown
          </span>

          {!selecting ? (
            <button
              type="button"
              onClick={() => setSelecting(true)}
              className="text-sm font-semibold rounded-lg border px-3 py-1.5 transition-colors hover:bg-black/5"
              style={{ borderColor: "#DAD8D0", color: "#1a1a1a" }}
            >
              Select
            </button>
          ) : (
            <>
              <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: "#EEECE4", color: "#8a8078" }}>
                {selected.size} selected
              </span>
              <button
                type="button"
                onClick={toggleAll}
                className="text-sm font-semibold rounded-lg border px-3 py-1.5 transition-colors hover:bg-black/5"
                style={{ borderColor: "#DAD8D0", color: "#1a1a1a" }}
              >
                {allSelected ? "Clear all" : "Select all"}
              </button>
              <button
                type="button"
                onClick={exitSelect}
                className="text-sm font-semibold rounded-lg border px-3 py-1.5 transition-colors hover:bg-black/5"
                style={{ borderColor: "#DAD8D0", color: "#1a1a1a" }}
              >
                Cancel
              </button>
            </>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: "#8a8078" }} className="text-left">
                {selecting && (
                  <th className="px-4 py-3 w-8">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                  </th>
                )}
                <th className="font-semibold px-4 py-3">Teacher</th>
                <th className="font-semibold px-4 py-3">Plan</th>
                <th className="font-semibold px-4 py-3">School</th>
                <th className="font-semibold px-4 py-3">Resources this month</th>
                <th className="font-semibold px-4 py-3">AI images</th>
                <th className="font-semibold px-4 py-3">Status</th>
                <th className="font-semibold px-4 py-3 text-right">Costs us</th>
                <th className="font-semibold px-4 py-3 text-right">Margin</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={selecting ? 9 : 8} className="px-4 py-10 text-center" style={{ color: "#8a8078" }}>
                    No teachers match that.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => {
                  const name = [u.first_name, u.surname].filter(Boolean).join(" ");
                  const p = u.plan ?? "free";
                  const ps = PLAN_STYLE[p] ?? PLAN_STYLE.free;
                  const st = u.subscription_status ?? "";
                  const ss = STATUS_STYLE[st];
                  const cost = Number(u.cost_usd);
                  const m = marginPct(p, cost);
                  return (
                    <tr key={u.id} className="border-t" style={{ borderColor: "#EEECE4" }}>
                      {selecting && (
                        <td className="px-4 py-3">
                          <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggle(u.id)} />
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium whitespace-nowrap" style={{ color: "#1a1a1a" }}>
                            {name || u.email}
                          </span>
                          {u.is_admin && (
                            <span
                              className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: "#1a1a1a", color: "#fff" }}
                            >
                              ADMIN
                            </span>
                          )}
                        </div>
                        {name && (
                          <div className="text-xs" style={{ color: "#8a8078" }}>
                            {u.email}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="text-xs font-semibold px-2 py-1 rounded-full capitalize whitespace-nowrap"
                          style={{ backgroundColor: ps.bg, color: ps.color }}
                        >
                          {p}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap" style={{ color: "#8a8078" }}>
                        Individual
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap" style={{ color: "#6b6055" }}>
                        {resourcesLabel(p, Number(u.generations_this_month))}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap" style={{ color: "#8a8078" }}>
                        No cap yet
                      </td>
                      <td className="px-4 py-3">
                        {st ? (
                          <span
                            className="text-xs font-semibold px-2 py-1 rounded-full capitalize whitespace-nowrap"
                            style={ss ? { backgroundColor: ss.bg, color: ss.color } : { backgroundColor: "#EEECE4", color: "#8a8078" }}
                          >
                            {st.replace("_", " ")}
                          </span>
                        ) : (
                          <span style={{ color: "#8a8078" }}>—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold whitespace-nowrap" style={{ color: "#1a1a1a" }}>
                        {usd(cost)}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {m === null ? (
                          <span
                            className="text-xs font-semibold px-2 py-1 rounded-full"
                            style={{ backgroundColor: "#EEECE4", color: "#8a8078" }}
                          >
                            costs {usd(cost)}
                          </span>
                        ) : (
                          <span
                            className="text-xs font-semibold px-2 py-1 rounded-full"
                            style={
                              m < 0
                                ? { backgroundColor: "#FBECEB", color: "#B3261E" }
                                : m < 0.35
                                  ? { backgroundColor: "#FDF3E5", color: "#A85F0C" }
                                  : { backgroundColor: "#DDF0E2", color: "#1f6b3b" }
                            }
                          >
                            {Math.round(m * 100)}%
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-2 px-4 py-3 border-t text-xs" style={{ borderColor: "#EEECE4", color: "#8a8078" }}>
          Showing {nf.format(filtered.length)} of {nf.format(rows.length)} teachers
        </div>
      </div>
    </>
  );
}
