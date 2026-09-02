"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/auth/client";
import GrantModal, { type GrantKind } from "../users/GrantModal";
import { PLANS, asPlanId } from "@/app/lib/plans";
import { fmtDateTime, fmtRelative, gbpFromUsd, nf } from "../format";
import {
  AiChip,
  Btn,
  C,
  EmptyState,
  Meter,
  PageHead,
  StatusTag,
  Tag,
  inputClass,
  inputStyle,
  useToast,
} from "../ui";

export interface ThreadRow {
  id: string;
  reference: string;
  user_id: string | null;
  teacher: string;
  email: string | null;
  school_name: string | null;
  plan: string;
  subject: string;
  status: string;
  priority: string;
  assigned_to: string | null;
  assignee: string | null;
  unread: boolean;
  message_count: number;
  preview: string | null;
  last_direction: string | null;
  updated_at: string;
  created_at: string;
}

export interface CannedReply {
  key: string;
  label: string;
  body: string;
  sort: number;
}

export interface SupportSummary {
  open_count: number;
  pending_count: number;
  high_priority: number;
  unassigned: number;
  unread: number;
  closed_this_week: number;
}

interface MessageRow {
  id: string;
  direction: string;
  body: string;
  author: string | null;
  created_at: string;
}

interface Allowance {
  resources_used: number;
  resources_topup: number;
  ai_used: number;
  ai_topup: number;
}

interface TeacherContext {
  cost_usd: number;
  generations: number;
}

export default function InboxView({
  initialThreads,
  canned,
  summary,
  currentUserId,
  initialOpenId = null,
}: {
  initialThreads: ThreadRow[];
  canned: CannedReply[];
  summary: SupportSummary | null;
  currentUserId: string;
  /** Thread to open on mount, from ?thread= — used by the Teachers drawer's
   *  "Open inbox". Falls back to the newest thread when absent or unknown. */
  initialOpenId?: string | null;
}) {
  const [threads, setThreads] = useState(initialThreads);
  const [openId, setOpenId] = useState<string | null>(
    (initialOpenId && initialThreads.some((t) => t.id === initialOpenId) ? initialOpenId : null) ??
      initialThreads[0]?.id ??
      null,
  );
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [allowance, setAllowance] = useState<Allowance | null>(null);
  const [context, setContext] = useState<TeacherContext | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [scopeFilter, setScopeFilter] = useState("");
  const [q, setQ] = useState("");
  const [toastNode, fire] = useToast();
  const msgEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  // Same modal the Teachers drawer uses — it already carries the live cost
  // estimate and the grant caps, and support should not get a second, laxer
  // way to hand out AI images.
  const [grantKind, setGrantKind] = useState<GrantKind | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);
  // Bumped after a grant to re-run the context rail's allowance fetch.
  const [railKey, setRailKey] = useState(0);

  const thread = useMemo(() => threads.find((t) => t.id === openId) ?? null, [threads, openId]);

  const reloadThreads = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.rpc("admin_threads", {
      p_status: statusFilter || null,
      p_filter: scopeFilter || null,
      q: q || null,
    });
    setThreads((data ?? []) as ThreadRow[]);
    // The sidebar badge is computed in the server layout, so without this it
    // stays stale for the rest of the session after a reply or a resolve.
    router.refresh();
  }, [statusFilter, scopeFilter, q, router]);

  // Debounced so typing in search doesn't fire a query per keystroke.
  useEffect(() => {
    const t = window.setTimeout(() => void reloadThreads(), 250);
    return () => window.clearTimeout(t);
  }, [reloadThreads]);

  // Load the open thread's messages and the teacher's context rail together.
  useEffect(() => {
    if (!thread) {
      setMessages([]);
      setAllowance(null);
      setContext(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const [{ data: msgs }, allowanceRes, detailRes] = await Promise.all([
        supabase.rpc("admin_thread_messages", { tid: thread.id }),
        thread.user_id
          ? supabase.rpc("monthly_allowance", { uid: thread.user_id })
          : Promise.resolve({ data: null }),
        thread.user_id
          ? supabase.rpc("admin_teacher_detail", { uid: thread.user_id })
          : Promise.resolve({ data: null }),
      ]);
      if (cancelled) return;
      setMessages((msgs ?? []) as MessageRow[]);
      const a = (allowanceRes.data ?? [])[0];
      setAllowance(a ? (a as Allowance) : null);
      const d = (detailRes.data ?? [])[0] as
        | { cost_usd: number; generations: number }
        | undefined;
      setContext(d ? { cost_usd: d.cost_usd, generations: d.generations } : null);

      // Reading a ticket is what marks it read. admin_set_thread has always
      // accepted { read: true } and nothing ever sent it, so the unread dot and
      // the sidebar badge used to persist until someone replied.
      if (thread.unread) {
        await supabase.rpc("admin_set_thread", {
          tid: thread.id,
          payload: { read: true },
        });
        if (cancelled) return;
        setThreads((prev) =>
          prev.map((t) => (t.id === thread.id ? { ...t, unread: false } : t)),
        );
        router.refresh();
      }
    })();
    return () => {
      cancelled = true;
    };
    // Keyed on the thread's identity, not the object: reloadThreads() replaces
    // every row on each poll, and depending on `thread` itself would re-run
    // this whole effect — and re-mark it read — on every refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread?.id, thread?.user_id, railKey]);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  // Goes through the route rather than calling admin_reply directly, because a
  // reply also has to be emailed and a database function cannot send mail.
  const send = async (isNote: boolean) => {
    if (!thread || !draft.trim()) return;
    setSending(true);
    let res: Response;
    try {
      res = await fetch("/api/support/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: thread.id, body: draft, isNote }),
      });
    } catch {
      setSending(false);
      fire("Couldn't reach the server — your reply wasn't sent.");
      return;
    }
    setSending(false);

    const result = (await res.json().catch(() => ({}))) as {
      error?: string;
      emailed?: boolean;
    };
    if (!res.ok) {
      fire(result.error ?? "Couldn't send that reply.");
      return;
    }

    setDraft("");
    const supabase = createClient();
    const { data } = await supabase.rpc("admin_thread_messages", { tid: thread.id });
    setMessages((data ?? []) as MessageRow[]);
    void reloadThreads();
    // Says what actually happened. Email is only configured in some
    // environments, and claiming "emailed" when nothing left is the habit this
    // whole change is meant to break.
    fire(
      isNote
        ? "Internal note added — the teacher can't see it."
        : result.emailed
          ? "Reply sent and emailed."
          : "Reply saved — email isn't configured, so it wasn't sent.",
    );
  };

  // Mints a real Stripe billing-portal URL and copies it, so the "Card failed"
  // reply has something to paste where its [link] placeholder used to be.
  const copyPortalLink = async () => {
    if (!thread?.user_id || portalBusy) return;
    setPortalBusy(true);
    const res = await fetch("/api/admin/teachers/billing-portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: thread.user_id }),
    });
    const json = await res.json().catch(() => ({}));
    setPortalBusy(false);
    if (!res.ok || !json.url) {
      fire(json.error ?? "Could not create a portal link.");
      return;
    }
    // Appended rather than replacing the draft: the canned reply is usually
    // already sitting in the composer and the link belongs at the end of it.
    setDraft((d) => (d.trim() ? `${d.trimEnd()}\n\n${json.url}` : json.url));
    try {
      await navigator.clipboard.writeText(json.url);
    } catch {
      // Clipboard can be refused; the link is in the draft either way.
    }
    // Said plainly because it matters: this link is a bearer credential to
    // their billing details, and it expires.
    fire("Billing link added to your reply. It expires shortly and lets anyone holding it edit their billing.");
  };

  const setThread = async (payload: Record<string, unknown>, msg: string) => {
    if (!thread) return;
    const supabase = createClient();
    const { error } = await supabase.rpc("admin_set_thread", { tid: thread.id, payload });
    if (error) {
      fire(error.message);
      return;
    }
    fire(msg);
    void reloadThreads();
  };

  const plan = PLANS[asPlanId(thread?.plan)];

  return (
    <>
      <PageHead title="Inbox" sub="Support conversations with teachers and schools.">
        {summary && (
          <div className="flex flex-wrap gap-1.5">
            <Tag tone={Number(summary.open_count) > 0 ? "warn" : "plain"}>
              {nf.format(Number(summary.open_count))} open
            </Tag>
            {Number(summary.unread) > 0 && (
              <Tag tone="warn">{nf.format(Number(summary.unread))} awaiting reply</Tag>
            )}
            {Number(summary.high_priority) > 0 && (
              <Tag tone="danger">{nf.format(Number(summary.high_priority))} high priority</Tag>
            )}
            {Number(summary.unassigned) > 0 && (
              <Tag>{nf.format(Number(summary.unassigned))} unassigned</Tag>
            )}
            {Number(summary.pending_count) > 0 && (
              <Tag>{nf.format(Number(summary.pending_count))} pending</Tag>
            )}
            {Number(summary.closed_this_week) > 0 && (
              <Tag tone="ok">{nf.format(Number(summary.closed_this_week))} closed this week</Tag>
            )}
          </div>
        )}
      </PageHead>

      <div
        className="rounded-2xl border overflow-hidden grid"
        style={{
          backgroundColor: C.surface,
          borderColor: C.border,
          gridTemplateColumns: "minmax(250px, 300px) minmax(0, 1fr) minmax(240px, 290px)",
          height: "calc(100vh - 190px)",
          minHeight: 460,
        }}
      >
        {/* ── Thread list ─────────────────────────────────────────────── */}
        <div className="border-r flex flex-col min-h-0" style={{ borderColor: C.border }}>
          <div
            className="p-3 border-b space-y-2 shrink-0"
            style={{ borderColor: C.divider, backgroundColor: C.surface }}
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search conversations"
              className={`${inputClass} w-full`}
              style={inputStyle}
            />
            <div className="flex gap-1.5">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`${inputClass} flex-1 min-w-0`}
                style={inputStyle}
              >
                <option value="">All</option>
                <option value="open">Open</option>
                <option value="pending">Pending</option>
                <option value="closed">Closed</option>
              </select>
              <select
                value={scopeFilter}
                onChange={(e) => setScopeFilter(e.target.value)}
                className={`${inputClass} flex-1 min-w-0`}
                style={inputStyle}
              >
                <option value="">Everyone</option>
                <option value="mine">Mine</option>
                <option value="unassigned">Unassigned</option>
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {threads.length === 0 ? (
              <EmptyState
                title="No conversations"
                body={
                  q || statusFilter || scopeFilter
                    ? "Try clearing a filter."
                    : "Tickets appear here when a teacher gets in touch from Help in the app, or when you open one from their account."
                }
              />
            ) : (
              threads.map((t) => {
                const active = t.id === openId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setOpenId(t.id)}
                    className="w-full text-left px-3 py-2.5 border-b transition-colors"
                    style={{
                      borderColor: C.divider,
                      backgroundColor: active ? C.divider : "transparent",
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className="font-semibold text-sm truncate flex-1"
                        style={{ color: C.ink }}
                      >
                        {t.teacher}
                      </span>
                      {t.priority === "high" && (
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: C.danger }}
                          title="High priority"
                        />
                      )}
                      {t.unread && (
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: C.ink }}
                          title="Unread reply"
                        />
                      )}
                      <span className="text-[11px] font-mono shrink-0" style={{ color: C.muted }}>
                        {fmtRelative(t.updated_at)}
                      </span>
                    </div>
                    <div className="text-xs mt-0.5 line-clamp-2 wrap-break-word" style={{ color: C.ink2 }}>
                      <b>{t.subject}</b>
                      {t.preview && (
                        <>
                          {" — "}
                          {t.last_direction === "outbound" && (
                            <span style={{ color: C.muted }}>You: </span>
                          )}
                          {t.last_direction === "note" && (
                            <span style={{ color: C.warn }}>Note: </span>
                          )}
                          {t.preview.slice(0, 60)}
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-1.5">
                      <StatusTag status={t.status} />
                      <Tag tone={t.plan === "free" ? "plain" : "brand"}>{t.plan}</Tag>
                      {/* Who the ball is with. The list is sorted by triage need,
                          so this is the fastest read of "does this need me?". */}
                      {t.status !== "closed" && t.last_direction === "inbound" && (
                        <Tag tone="warn">Waiting on us</Tag>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Conversation ────────────────────────────────────────────── */}
        <div className="flex flex-col min-w-0 min-h-0">
          {!thread ? (
            <div className="flex-1 grid place-items-center">
              <p className="text-sm" style={{ color: C.muted }}>
                Pick a conversation.
              </p>
            </div>
          ) : (
            <>
              <div
                className="flex items-center gap-2 px-4 py-3 border-b shrink-0 flex-wrap"
                style={{ borderColor: C.border }}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate" style={{ color: C.ink }}>
                    {thread.subject}
                  </div>
                  <div className="text-xs font-mono truncate" style={{ color: C.muted }}>
                    {thread.reference} · {thread.teacher}
                    {thread.school_name && ` · ${thread.school_name}`} ·{" "}
                    {thread.assignee ? `assigned to ${thread.assignee}` : "unassigned"}
                  </div>
                </div>
                <select
                  value={thread.status}
                  onChange={(e) => setThread({ status: e.target.value }, `Marked ${e.target.value}.`)}
                  className={inputClass}
                  style={inputStyle}
                >
                  <option value="open">Open</option>
                  <option value="pending">Pending</option>
                  <option value="closed">Closed</option>
                </select>
                {thread.assigned_to !== currentUserId && (
                  <Btn size="sm" onClick={() => setThread({ assign_to_me: true }, "Assigned to you.")}>
                    Assign to me
                  </Btn>
                )}
                {thread.status !== "closed" && (
                  <Btn
                    size="sm"
                    variant="primary"
                    onClick={() => setThread({ status: "closed" }, "Ticket resolved.")}
                  >
                    Resolve
                  </Btn>
                )}
              </div>

              <div
                className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3"
                style={{ backgroundColor: C.page }}
              >
                {messages.length === 0 ? (
                  <p className="text-sm text-center" style={{ color: C.muted }}>
                    No messages yet.
                  </p>
                ) : (
                  messages.map((m) => {
                    const isNote = m.direction === "note";
                    const isUs = m.direction === "outbound";
                    return (
                      <div
                        key={m.id}
                        className="flex flex-col gap-1 max-w-[50%] min-w-0"
                        style={{ alignSelf: isUs ? "flex-end" : "flex-start" }}
                      >
                        <div
                          className="px-3 py-2 rounded-xl text-sm border"
                          style={
                            isNote
                              ? { backgroundColor: C.warnBg, borderColor: "#EFDFB4", color: C.ink }
                              : isUs
                                ? { backgroundColor: C.ink, borderColor: C.ink, color: "#fff" }
                                : { backgroundColor: C.white, borderColor: C.border, color: C.ink }
                          }
                        >
                          {isNote && (
                            <div className="text-xs font-bold mb-1" style={{ color: C.warn }}>
                              Internal note — not visible to the teacher
                            </div>
                          )}
                          {/* wrap-break-word because whitespace-pre-wrap only
                              wraps at existing whitespace — a pasted URL or
                              stack trace would otherwise overflow the bubble. */}
                          <div className="whitespace-pre-wrap wrap-break-word">{m.body}</div>
                        </div>
                        <div
                          className="text-[10px] font-mono"
                          style={{ color: C.muted, textAlign: isUs ? "right" : "left" }}
                        >
                          {m.direction === "inbound" ? thread.teacher : (m.author ?? "Jooma")} ·{" "}
                          {fmtDateTime(m.created_at)}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={msgEndRef} />
              </div>

              <div
                className="border-t px-4 py-3 shrink-0"
                style={{ borderColor: C.border, backgroundColor: C.surface }}
              >
                {/* Actions, not scripts. The canned replies below say what we
                    did; these are what actually does it, so support can fix the
                    problem in the thread instead of opening the Teachers page
                    in another tab and losing the conversation. */}
                {thread.user_id && (
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    <span className="text-[11px] font-semibold" style={{ color: C.muted }}>
                      Fix it
                    </span>
                    <Btn size="sm" onClick={() => setGrantKind("resource")}>
                      Grant resources
                    </Btn>
                    <Btn size="sm" onClick={() => setGrantKind("ai_image")}>
                      Grant AI images
                    </Btn>
                    <Btn size="sm" onClick={() => setGrantKind("credit_gbp")}>
                      Grant AI credit
                    </Btn>
                    <Btn size="sm" onClick={copyPortalLink} disabled={portalBusy}>
                      {portalBusy ? "Creating…" : "Copy billing link"}
                    </Btn>
                  </div>
                )}
                {canned.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {canned.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => setDraft(c.body)}
                        className="text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors hover:bg-black/5"
                        style={{ borderColor: C.border, color: C.ink2 }}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                )}
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={3}
                  placeholder={`Reply to ${thread.teacher}…`}
                  className="w-full px-3 py-2 border rounded-xl bg-white text-sm resize-none focus:outline-none focus:border-[#1D1730] transition-colors"
                  style={{ borderColor: C.border }}
                />
                <div className="flex items-center gap-2 mt-2">
                  <Btn
                    size="sm"
                    onClick={() => send(true)}
                    disabled={sending || !draft.trim()}
                    title="Only your team sees this"
                  >
                    Add internal note
                  </Btn>
                  <div className="flex-1" />
                  <Btn
                    size="sm"
                    variant="primary"
                    onClick={() => send(false)}
                    disabled={sending || !draft.trim()}
                  >
                    {sending ? "Sending…" : "Send reply"}
                  </Btn>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Context rail ────────────────────────────────────────────── */}
        <div
          className="border-l overflow-y-auto p-4 min-h-0"
          style={{ borderColor: C.border }}
        >
          {!thread ? null : !thread.user_id ? (
            <p className="text-sm" style={{ color: C.muted }}>
              No linked account.
            </p>
          ) : (
            <>
              <div className="font-bold text-sm" style={{ color: C.ink }}>
                {thread.teacher}
              </div>
              <div className="text-xs font-mono truncate mb-2" style={{ color: C.muted }}>
                {thread.email}
              </div>
              <div className="flex flex-wrap gap-1.5 mb-4">
                <Tag tone={thread.plan === "free" ? "plain" : "brand"}>{plan.name}</Tag>
                {thread.school_name && <Tag>{thread.school_name}</Tag>}
              </div>

              <h3
                className="text-xs font-semibold uppercase tracking-wide mb-2"
                style={{ color: C.muted }}
              >
                This month
              </h3>
              <div className="mb-2">
                <div className="text-xs mb-1" style={{ color: C.ink2 }}>
                  Resources
                </div>
                <Meter
                  used={allowance?.resources_used ?? 0}
                  allow={plan.limits.monthlyGenerations}
                  topup={allowance?.resources_topup ?? 0}
                />
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs" style={{ color: C.ink2 }}>
                  AI images
                </span>
                <AiChip
                  used={allowance?.ai_used ?? 0}
                  allow={plan.limits.aiImageSlideshows}
                  topup={allowance?.ai_topup ?? 0}
                />
              </div>
              {context && (
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs" style={{ color: C.ink2 }}>
                    Costs us
                  </span>
                  <span className="text-xs font-semibold tabular-nums" style={{ color: C.ink }}>
                    {gbpFromUsd(Number(context.cost_usd))}
                  </span>
                </div>
              )}

              <div className="h-px my-3" style={{ backgroundColor: C.divider }} />

              <h3
                className="text-xs font-semibold uppercase tracking-wide mb-2"
                style={{ color: C.muted }}
              >
                Ticket
              </h3>
              <div className="text-xs space-y-1.5" style={{ color: C.ink2 }}>
                {[
                  ["Reference", thread.reference],
                  ["Opened", fmtRelative(thread.created_at)],
                  ["Messages", nf.format(Number(thread.message_count))],
                  ["Priority", thread.priority],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <span style={{ color: C.muted }}>{k}</span>
                    <span style={{ color: C.ink }}>{v}</span>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex flex-col gap-1.5">
                <Btn
                  size="sm"
                  onClick={() =>
                    setThread(
                      { priority: thread.priority === "high" ? "normal" : "high" },
                      thread.priority === "high" ? "Priority lowered." : "Marked high priority.",
                    )
                  }
                >
                  {thread.priority === "high" ? "Lower priority" : "Mark high priority"}
                </Btn>
              </div>
            </>
          )}
        </div>
      </div>

      {grantKind && thread?.user_id && (
        <GrantModal
          userId={thread.user_id}
          name={thread.teacher}
          kind={grantKind}
          onClose={() => setGrantKind(null)}
          onGranted={(msg) => {
            setGrantKind(null);
            fire(msg);
            // The context rail reads the allowance, so refresh it — otherwise
            // you grant resources and the meter beside you still says empty.
            setRailKey((k) => k + 1);
          }}
        />
      )}

      {toastNode}
    </>
  );
}
