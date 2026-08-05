"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { createClient } from "@/app/lib/auth/client";
import { PLANS, asPlanId } from "@/app/lib/plans";
import { typeLabel, formatDate } from "@/app/lib/toolRunDisplay";
import { gbpFromUsd, nf } from "../format";
import { AiChip, Meter } from "../ui";
import GrantModal, { type GrantKind } from "./GrantModal";

// Small outline/filled/danger button, matching the style already used in
// AdminTeachersHeaderActions and AddTeacherModal.
function DrawerBtn({
  children,
  onClick,
  variant = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "primary" | "danger";
}) {
  const styles: Record<string, React.CSSProperties> = {
    default: { borderColor: "#DAD8D0", color: "#1a1a1a", backgroundColor: "transparent" },
    primary: { borderColor: "#1a1a1a", color: "#fff", backgroundColor: "#1a1a1a" },
    danger: { borderColor: "#EDD3D1", color: "#B3261E", backgroundColor: "transparent" },
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs font-semibold rounded-lg border px-3 py-1.5 transition-colors hover:bg-black/5"
      style={styles[variant]}
    >
      {children}
    </button>
  );
}

interface TeacherDetail {
  id: string;
  email: string;
  first_name: string | null;
  surname: string | null;
  dial_code: string | null;
  phone: string | null;
  country: string | null;
  plan: string | null;
  subscription_status: string | null;
  stripe_customer_id: string | null;
  current_period_end: string | null;
  is_admin: boolean;
  created_at: string;
  generations: number;
  generations_this_month: number;
  cost_usd: number;
}

interface Allowance {
  resources_used: number;
  resources_topup: number;
  ai_used: number;
  ai_topup: number;
}

interface RunRow {
  id: string;
  tool_slug: string;
  title: string | null;
  created_at: string;
  // Best-effort match to the tool_runs row's token_usage/asset_cost within a
  // 2-minute window (see the admin_teacher_activity_cost migration) — close
  // enough for a timeline, not an authoritative accounting figure.
  approx_cost_usd: number;
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  active: { bg: "#DDF0E2", color: "#1f6b3b" },
  trialing: { bg: "#E2E8F5", color: "#2a4a8a" },
  past_due: { bg: "#FBECEB", color: "#B3261E" },
  canceled: { bg: "#EEECE4", color: "#8a8078" },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function TeacherDrawer({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<TeacherDetail | null>(null);
  const [runs, setRuns] = useState<RunRow[] | null>(null);
  const [allowance, setAllowance] = useState<Allowance | null>(null);
  const [grantKind, setGrantKind] = useState<GrantKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Mounts closed (off-screen, scrim transparent) then flips open on the next
  // frame so the browser actually animates the transition instead of
  // starting already in its end state. Same drawer.on / scrim.on pattern as
  // the CEO's mockup — a translateX slide + opacity fade, ~220ms ease-out.
  const [open, setOpen] = useState(false);
  // None of these actions have real backend yet (no grant/refund/suspend/
  // plan-change/view-as routes) — same honest-stub pattern as Export/Invite:
  // clicking says so instead of silently doing nothing.
  const [notice, setNotice] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  useEffect(() => {
    const raf = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleClose = () => {
    setOpen(false);
    window.setTimeout(onClose, 220);
  };

  const fire = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice((n) => (n === msg ? null : n)), 3000);
  };

  // Pulled out so a successful grant can refresh the allowance without
  // reopening the drawer.
  const loadAllowance = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.rpc("monthly_allowance", { uid: userId });
    if (data && data.length > 0) setAllowance(data[0] as Allowance);
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    (async () => {
      const [{ data: d, error: dErr }, { data: r }, { data: a }] = await Promise.all([
        supabase.rpc("admin_teacher_detail", { uid: userId }),
        supabase.rpc("admin_teacher_recent_runs", { uid: userId, lim: 10 }),
        supabase.rpc("monthly_allowance", { uid: userId }),
      ]);
      if (cancelled) return;
      if (dErr || !d || d.length === 0) {
        setError("Could not load this teacher.");
        return;
      }
      setDetail(d[0] as TeacherDetail);
      setRuns((r ?? []) as RunRow[]);
      if (a && a.length > 0) setAllowance(a[0] as Allowance);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const name = detail ? [detail.first_name, detail.surname].filter(Boolean).join(" ") : "";
  const plan = detail?.plan ?? "free";
  const p = PLANS[asPlanId(plan)];
  const status = detail?.subscription_status ?? "";
  const ss = STATUS_STYLE[status];
  const dial = detail?.dial_code ? `+${detail.dial_code.replace(/^\+/, "")}` : null;

  return (
    <div className="fixed inset-0 z-1000" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-180"
        style={{ opacity: open ? 1 : 0 }}
        onClick={handleClose}
      />
      <aside
        className="absolute top-0 right-0 h-screen w-full max-w-md shadow-2xl border-l flex flex-col"
        style={{
          borderColor: "#DAD8D0",
          backgroundColor: "#FAF9F5",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
      >
        {!detail && !error ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm" style={{ color: "#8a8078" }}>
              Loading…
            </p>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6">
            <p className="text-sm" style={{ color: "#B3261E" }}>
              {error}
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="text-sm font-semibold rounded-xl border px-4 py-2 transition-colors hover:bg-black/5"
              style={{ borderColor: "#DAD8D0", color: "#1a1a1a" }}
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3 p-5 pb-4 border-b shrink-0" style={{ borderColor: "#DAD8D0" }}>
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
                style={{ backgroundColor: "#EEECE4", color: "#1a1a1a" }}
              >
                {(name || detail!.email).slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-bold truncate" style={{ color: "#1a1a1a" }}>
                  {name || detail!.email}
                </h2>
                <p className="text-sm truncate" style={{ color: "#8a8078" }}>
                  {detail!.email}
                </p>
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: plan === "free" ? "#EEECE4" : "#DDF0E2", color: plan === "free" ? "#8a8078" : "#1f6b3b" }}
                  >
                    {p.name}
                  </span>
                  {status && (
                    <span
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize"
                      style={ss ? { backgroundColor: ss.bg, color: ss.color } : { backgroundColor: "#EEECE4", color: "#8a8078" }}
                    >
                      {status.replace("_", " ")}
                    </span>
                  )}
                  {detail!.is_admin && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: "#1a1a1a", color: "#fff" }}>
                      ADMIN
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="p-1.5 rounded-lg hover:bg-black/5 shrink-0"
                style={{ color: "#8a8078" }}
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "#8a8078" }}>
                  This month
                </h3>
                <div className="rounded-xl border p-3.5 space-y-3" style={{ borderColor: "#DAD8D0", backgroundColor: "#fff" }}>
                  {detail!.is_admin && (
                    <div
                      className="rounded-lg px-3 py-2 text-xs"
                      style={{ backgroundColor: "#F1EDFD", color: "#6B4FD8" }}
                    >
                      <b>Admin account — bypasses the generation cap.</b> This usage is
                      internal, isn&apos;t billable, and doesn&apos;t count against any plan
                      limit.
                    </div>
                  )}
                  <div>
                    <div className="text-sm mb-1.5" style={{ color: "#6b6055" }}>
                      Resources
                    </div>
                    {detail!.is_admin ? (
                      <span className="text-sm tabular-nums" style={{ color: "#1a1a1a" }}>
                        {nf.format(allowance?.resources_used ?? detail!.generations_this_month)}{" "}
                        used
                        <span style={{ color: "#8a8078" }}> · no cap</span>
                      </span>
                    ) : (
                      <Meter
                        used={allowance?.resources_used ?? detail!.generations_this_month}
                        allow={p.limits.monthlyGenerations}
                        topup={allowance?.resources_topup ?? 0}
                      />
                    )}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ color: "#6b6055" }}>AI-image slideshows</span>
                    <AiChip
                      used={allowance?.ai_used ?? 0}
                      allow={p.limits.aiImageSlideshows}
                      topup={allowance?.ai_topup ?? 0}
                    />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ color: "#6b6055" }}>Costs us</span>
                    <span className="font-semibold" style={{ color: "#1a1a1a" }}>
                      {gbpFromUsd(detail!.cost_usd)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <DrawerBtn onClick={() => setGrantKind("resource")}>Grant resources</DrawerBtn>
                    <DrawerBtn onClick={() => setGrantKind("ai_image")}>Grant AI images</DrawerBtn>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "#8a8078" }}>
                  Account
                </h3>
                <dl className="text-sm">
                  <Row label="User ID" value={<span className="font-mono text-xs">{detail!.id}</span>} />
                  <Row label="Joined" value={fmtDate(detail!.created_at)} />
                  <Row label="Phone" value={detail!.phone ? `${dial ?? ""} ${detail!.phone}`.trim() : "—"} />
                  <Row label="Country" value={detail!.country ?? "—"} />
                  <Row label="Generations (all time)" value={nf.format(detail!.generations)} />
                </dl>
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "#8a8078" }}>
                  Subscription
                </h3>
                <dl className="text-sm">
                  <Row label="Plan" value={p.name} />
                  <Row
                    label="Billing"
                    value={detail!.stripe_customer_id ? "Card · Stripe" : plan === "free" ? "None" : "—"}
                  />
                  <Row
                    label="Renews"
                    value={
                      detail!.current_period_end
                        ? status === "canceled"
                          ? `Access ends ${fmtDate(detail!.current_period_end)}`
                          : fmtDate(detail!.current_period_end)
                        : "—"
                    }
                  />
                  <Row
                    label="Payment status"
                    value={
                      status === "past_due" ? (
                        <span style={{ color: "#B3261E", fontWeight: 600 }}>Past due</span>
                      ) : status ? (
                        status.replace("_", " ")
                      ) : (
                        "—"
                      )
                    }
                  />
                </dl>
                <div className="flex flex-wrap gap-2 mt-3">
                  <DrawerBtn onClick={() => fire("Changing plan isn't wired up yet.")}>Change plan</DrawerBtn>
                  {plan !== "free" && (
                    <DrawerBtn onClick={() => fire(`Annual offer isn't wired up yet.`)}>Offer annual</DrawerBtn>
                  )}
                  {detail!.stripe_customer_id && (
                    <DrawerBtn onClick={() => fire("Card update link isn't wired up yet.")}>Send card update link</DrawerBtn>
                  )}
                  {plan !== "free" && (
                    <DrawerBtn onClick={() => fire("Refunds aren't wired up yet.")}>Refund</DrawerBtn>
                  )}
                </div>
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "#8a8078" }}>
                  Recent activity
                </h3>
                {runs === null ? (
                  <p className="text-sm" style={{ color: "#8a8078" }}>
                    Loading…
                  </p>
                ) : runs.length === 0 ? (
                  <p className="text-sm" style={{ color: "#8a8078" }}>
                    No generations yet.
                  </p>
                ) : (
                  <ol className="relative pl-4" style={{ borderLeft: "1px solid #DAD8D0" }}>
                    {runs.map((r, i) => (
                      <li key={r.id} className="relative pb-4 last:pb-0">
                        <span
                          className="absolute -left-5.25 top-1 w-2.5 h-2.5 rounded-full border-2"
                          style={
                            i === 0
                              ? { backgroundColor: "#1a1a1a", borderColor: "#1a1a1a" }
                              : { backgroundColor: "#FAF9F5", borderColor: "#DAD8D0" }
                          }
                        />
                        <p className="text-sm font-medium" style={{ color: "#1a1a1a" }}>
                          {r.title || typeLabel(r.tool_slug)}
                        </p>
                        <p className="text-xs font-mono" style={{ color: "#8a8078" }}>
                          {typeLabel(r.tool_slug)} ·{" "}
                          {r.approx_cost_usd > 0 ? gbpFromUsd(r.approx_cost_usd) : "—"} ·{" "}
                          {formatDate(r.created_at)}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
                <button
                  type="button"
                  onClick={() => fire("Full activity log isn't wired up yet.")}
                  className="text-xs font-semibold mt-1 hover:underline"
                  style={{ color: "#1a1a1a" }}
                >
                  See full activity log →
                </button>
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "#8a8078" }}>
                  Support history
                </h3>
                <div
                  className="rounded-xl border border-dashed p-4 text-center"
                  style={{ borderColor: "#DAD8D0", backgroundColor: "#fff" }}
                >
                  <p className="text-sm font-medium" style={{ color: "#8a8078" }}>
                    Coming soon
                  </p>
                  <p className="text-xs mt-1" style={{ color: "#8a8078" }}>
                    Support tickets will appear here once Inbox is built.
                  </p>
                </div>
                <DrawerBtn onClick={() => fire("Inbox isn't wired up yet.")}>Message this teacher</DrawerBtn>
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "#8a8078" }}>
                  Internal notes
                </h3>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows={3}
                  placeholder="Only your team sees this."
                  className="w-full px-3 py-2.5 border rounded-xl bg-white text-sm placeholder-[#A5A5A5] focus:outline-none focus:border-[#1a1a1a] transition-colors resize-none"
                  style={{ borderColor: "#DAD8D0" }}
                />
                <div className="mt-2">
                  <DrawerBtn onClick={() => fire("Saving notes isn't wired up yet.")}>Save note</DrawerBtn>
                </div>
              </section>
            </div>

            <div
              className="shrink-0 border-t px-5 py-3.5"
              style={{ borderColor: "#DAD8D0", backgroundColor: "#F1EFE9" }}
            >
              {notice && (
                <p className="text-xs mb-2" style={{ color: "#A85F0C" }}>
                  {notice}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <DrawerBtn onClick={() => fire(`Password reset email would be sent to ${detail!.email}.`)}>
                  Reset password
                </DrawerBtn>
                <DrawerBtn onClick={() => fire("Viewing as a teacher isn't wired up yet.")}>View as this teacher</DrawerBtn>
                <div className="flex-1" />
                <DrawerBtn variant="danger" onClick={() => fire("Suspending accounts isn't wired up yet.")}>
                  Suspend
                </DrawerBtn>
              </div>
            </div>
          </>
        )}
      </aside>

      {grantKind && detail && (
        <GrantModal
          userId={detail.id}
          name={name || detail.email}
          kind={grantKind}
          onClose={() => setGrantKind(null)}
          onGranted={(msg) => {
            fire(msg);
            // Reflect the new top-up in the meter straight away rather than
            // making the admin close and reopen the drawer to see it.
            void loadAllowance();
          }}
        />
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b" style={{ borderColor: "#EEECE4" }}>
      <dt style={{ color: "#8a8078" }}>{label}</dt>
      <dd className="text-right" style={{ color: "#1a1a1a" }}>
        {value}
      </dd>
    </div>
  );
}
