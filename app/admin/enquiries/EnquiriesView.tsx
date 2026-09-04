"use client";

// The enquiries console: contact messages and school enquiries in one list.
//
// Built on the same bones as app/admin/inbox/InboxView.tsx, which is the closest
// analogue in the product. Three of its decisions are load-bearing and are kept
// deliberately:
//
//   1. Server-seeds the rows, then re-fetches from the client on filter change.
//      First paint has no spinner; the client owns the filters after that.
//   2. router.refresh() after every mutation, because the sidebar badge is
//      computed in the server layout and would otherwise stay stale for the rest
//      of the session.
//   3. The detail effect is keyed on `open?.id`, NOT the object. reload()
//      replaces every row object, so keying on the object re-runs the effect on
//      every poll.
//
// The two "sub-branches" the brief asks for are the kind filter rather than
// tabs: the console has no tab pattern anywhere, and one list with one detail
// pane is one code path instead of two.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/auth/client";
import { heardAboutLabel } from "@/app/lib/enquiry";
import { fmtDateTime, fmtRelative } from "../format";
import {
  C,
  Btn,
  Card,
  CardHeader,
  CardTitle,
  DL,
  EmptyState,
  FilterBar,
  PageHead,
  Row,
  StatusTag,
  Tag,
  inputClass,
  inputStyle,
  useToast,
} from "../ui";

export interface EnquiryRow {
  id: string;
  reference: string;
  kind: "contact" | "school";
  name: string;
  email: string;
  phone: string | null;
  school: string | null;
  licences: number | null;
  heard_about: string | null;
  heard_other: string | null;
  message: string | null;
  status: string;
  assigned_to: string | null;
  assignee: string | null;
  user_id: string | null;
  reply_count: number;
  last_reply_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ReplyRow {
  id: string;
  body: string;
  is_note: boolean;
  emailed: boolean;
  author: string | null;
  created_at: string;
}

interface Summary {
  new_count: number;
  in_progress_count: number;
  school_new: number;
  contact_new: number;
}

const KINDS = [
  { value: "", label: "All enquiries" },
  { value: "contact", label: "Contact" },
  { value: "school", label: "School enquiries" },
];

const STATUSES = [
  { value: "", label: "All statuses" },
  { value: "new", label: "New" },
  { value: "in_progress", label: "In progress" },
  { value: "closed", label: "Closed" },
];

export default function EnquiriesView({
  initialRows,
  summary,
  initialKind,
  initialOpenId,
  currentUserId,
}: {
  initialRows: EnquiryRow[];
  summary: Summary | null;
  initialKind: string;
  initialOpenId: string | null;
  currentUserId: string;
}) {
  const router = useRouter();
  const [toast, fire] = useToast();

  const [rows, setRows] = useState(initialRows);
  const [kind, setKind] = useState(initialKind);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const [openId, setOpenId] = useState<string | null>(
    initialOpenId && initialRows.some((r) => r.id === initialOpenId)
      ? initialOpenId
      : (initialRows[0]?.id ?? null),
  );
  // Stamped with the enquiry they belong to, so switching rows shows an empty
  // thread immediately rather than the previous row's replies until the fetch
  // lands. Deriving it this way also avoids a setState in the effect body, which
  // would cascade a render on every selection.
  const [replyState, setReplyState] = useState<{ id: string; rows: ReplyRow[] }>({
    id: "",
    rows: [],
  });
  const replies = replyState.id === openId ? replyState.rows : [];
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const open = useMemo(() => rows.find((r) => r.id === openId) ?? null, [rows, openId]);

  const reload = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.rpc("admin_enquiries", {
      p_kind: kind || null,
      p_status: status || null,
      q: q || null,
    });
    setRows((data ?? []) as EnquiryRow[]);
    // The sidebar badge is computed in the server layout, so without this it
    // stays stale for the rest of the session after a reply or a close.
    router.refresh();
  }, [kind, status, q, router]);

  // Debounced so typing in the search box does not fire a query per keystroke.
  useEffect(() => {
    let cancelled = false;
    const t = window.setTimeout(async () => {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase.rpc("admin_enquiries", {
        p_kind: kind || null,
        p_status: status || null,
        q: q || null,
      });
      if (cancelled) return;
      setRows((data ?? []) as EnquiryRow[]);
      setLoading(false);
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [kind, status, q]);

  // Keyed on the id, not the object: reload() replaces every row, which would
  // otherwise re-run this on every poll.
  useEffect(() => {
    if (!openId) return;
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const { data } = await supabase.rpc("admin_enquiry_replies", { eid: openId });
      if (!cancelled) setReplyState({ id: openId, rows: (data ?? []) as ReplyRow[] });
    })();
    return () => {
      cancelled = true;
    };
  }, [openId]);

  const patch = async (payload: Record<string, unknown>, msg: string) => {
    if (!open) return;
    const supabase = createClient();
    const { error } = await supabase.rpc("admin_set_enquiry", {
      eid: open.id,
      payload,
    });
    if (error) {
      fire(error.message);
      return;
    }
    fire(msg);
    void reload();
  };

  const send = async (isNote: boolean) => {
    if (!open || !draft.trim()) return;
    setSending(true);
    let res: Response;
    try {
      res = await fetch("/api/enquiries/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enquiryId: open.id, body: draft, isNote }),
      });
    } catch {
      setSending(false);
      fire("Couldn't reach the server. Your reply wasn't sent.");
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
    const { data } = await supabase.rpc("admin_enquiry_replies", { eid: open.id });
    setReplyState({ id: open.id, rows: (data ?? []) as ReplyRow[] });
    void reload();
    // Reports what actually happened rather than assuming the mail went out.
    fire(
      isNote
        ? "Note added. The enquirer can't see it."
        : result.emailed
          ? `Reply sent to ${open.email}.`
          : "Reply saved, but the email didn't send. Check the mailer.",
    );
  };

  const filtered = q || kind || status;

  return (
    <>
      <PageHead
        title="Enquiries"
        sub="Contact messages and school enquiries from the website and the app."
      >
        {summary && (
          <div className="flex items-center gap-2">
            <Tag tone={summary.new_count > 0 ? "brand" : "plain"} dot>
              {summary.new_count} new
            </Tag>
            <Tag tone="plain">{summary.school_new} school</Tag>
            <Tag tone="plain">{summary.contact_new} contact</Tag>
          </div>
        )}
      </PageHead>

      <Card>
        <CardHeader>
          <CardTitle>All enquiries</CardTitle>
        </CardHeader>

        <FilterBar>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, school or reference"
            className={`${inputClass} w-72`}
            style={inputStyle}
          />
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className={inputClass}
            style={inputStyle}
            aria-label="Filter by type"
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={inputClass}
            style={inputStyle}
            aria-label="Filter by status"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          {loading && (
            <span className="text-xs" style={{ color: C.muted }}>
              Loading…
            </span>
          )}
          <div className="flex-1" />
          <Tag>{rows.length} shown</Tag>
        </FilterBar>

        {rows.length === 0 ? (
          <EmptyState
            title={filtered ? "No enquiries match that" : "No enquiries yet"}
            body={
              filtered
                ? "Try clearing a filter."
                : "Messages sent from the contact form on the website, or from Help in the app, land here."
            }
          />
        ) : (
          <div
            className="grid"
            style={{
              gridTemplateColumns: "minmax(260px, 320px) minmax(0, 1fr)",
              height: "calc(100vh - 260px)",
              minHeight: 460,
            }}
          >
            {/* ── List ───────────────────────────────────────────────── */}
            <div
              className="border-r overflow-y-auto"
              style={{ borderColor: C.divider }}
            >
              {rows.map((r) => {
                const active = r.id === openId;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setOpenId(r.id)}
                    className="w-full text-left px-4 py-3 border-b transition-colors cursor-pointer hover:bg-black/3"
                    style={{
                      borderColor: C.divider,
                      backgroundColor: active ? C.brandBg : "transparent",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="text-sm font-semibold truncate flex-1"
                        style={{ color: C.ink }}
                      >
                        {r.name}
                      </span>
                      <Tag tone={r.kind === "school" ? "brand" : "plain"}>
                        {r.kind === "school" ? "School" : "Contact"}
                      </Tag>
                    </div>
                    <p className="text-xs truncate mt-0.5" style={{ color: C.muted }}>
                      {r.school || r.email}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <StatusTag status={r.status} />
                      <span className="text-[10px]" style={{ color: C.muted }}>
                        {fmtRelative(r.created_at)}
                      </span>
                      {r.reply_count > 0 && (
                        <span className="text-[10px]" style={{ color: C.muted }}>
                          · {r.reply_count} sent
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* ── Detail ─────────────────────────────────────────────── */}
            <div className="flex flex-col min-w-0">
              {!open ? (
                <div
                  className="flex-1 flex items-center justify-center text-sm"
                  style={{ color: C.muted }}
                >
                  Pick an enquiry.
                </div>
              ) : (
                <>
                  <div
                    className="shrink-0 px-5 py-3 border-b flex items-center gap-2 flex-wrap"
                    style={{ borderColor: C.divider }}
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold truncate" style={{ color: C.ink }}>
                        {open.kind === "school" ? "School enquiry" : "Contact"} from{" "}
                        {open.name}
                      </h3>
                      <p className="text-xs font-mono" style={{ color: C.muted }}>
                        {open.reference} · {fmtDateTime(open.created_at)}
                      </p>
                    </div>
                    <select
                      value={open.status}
                      onChange={(e) =>
                        void patch({ status: e.target.value }, "Status updated.")
                      }
                      className={inputClass}
                      style={inputStyle}
                      aria-label="Status"
                    >
                      <option value="new">New</option>
                      <option value="in_progress">In progress</option>
                      <option value="closed">Closed</option>
                    </select>
                    {open.assigned_to === currentUserId ? (
                      <Btn size="sm" onClick={() => void patch({ unassign: true }, "Unassigned.")}>
                        Unassign
                      </Btn>
                    ) : (
                      <Btn
                        size="sm"
                        onClick={() => void patch({ assign_to_me: true }, "Assigned to you.")}
                      >
                        Assign to me
                      </Btn>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto p-5">
                    <DL>
                      <Row label="Name" value={open.name} />
                      <Row
                        label="Email"
                        value={
                          <a
                            href={`mailto:${open.email}`}
                            className="underline"
                            style={{ color: C.brand }}
                          >
                            {open.email}
                          </a>
                        }
                      />
                      {open.phone && (
                        <Row
                          label="Number"
                          value={
                            <a href={`tel:${open.phone}`} className="underline" style={{ color: C.brand }}>
                              {open.phone}
                            </a>
                          }
                        />
                      )}
                      {open.school && <Row label="School" value={open.school} />}
                      {open.licences !== null && (
                        <Row label="Licences interested in" value={open.licences} />
                      )}
                      {open.heard_about && (
                        <Row
                          label="Heard about Jooma"
                          value={
                            open.heard_other
                              ? `${heardAboutLabel(open.heard_about)}: ${open.heard_other}`
                              : heardAboutLabel(open.heard_about)
                          }
                        />
                      )}
                      <Row
                        label="Account"
                        value={open.user_id ? "Signed in when sent" : "Not a Jooma user"}
                      />
                      {open.assignee && <Row label="Assigned to" value={open.assignee} />}
                    </DL>

                    {open.message && (
                      <div
                        className="mt-4 rounded-xl p-4 text-sm whitespace-pre-wrap wrap-break-word"
                        style={{ backgroundColor: C.page, color: C.ink }}
                      >
                        {open.message}
                      </div>
                    )}

                    {replies.length > 0 && (
                      <div className="mt-5 flex flex-col gap-3">
                        {replies.map((r) => (
                          <div
                            key={r.id}
                            className="rounded-xl border p-3 text-sm whitespace-pre-wrap wrap-break-word"
                            style={
                              r.is_note
                                ? { backgroundColor: C.warnBg, borderColor: "#EFDFB4", color: C.ink }
                                : { backgroundColor: C.ink, borderColor: C.ink, color: "#fff" }
                            }
                          >
                            <p
                              className="text-[11px] font-semibold mb-1"
                              style={{ color: r.is_note ? C.warn : "rgba(255,255,255,.65)" }}
                            >
                              {r.is_note
                                ? "Internal note. Not visible to the enquirer."
                                : `Sent by ${r.author ?? "an admin"}${r.emailed ? "" : " (email failed)"}`}
                              {" · "}
                              {fmtRelative(r.created_at)}
                            </p>
                            {r.body}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ── Composer ─────────────────────────────────────── */}
                  <div
                    className="shrink-0 border-t p-4"
                    style={{ borderColor: C.divider }}
                  >
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={3}
                      maxLength={5000}
                      placeholder={`Reply to ${open.name}…`}
                      className="w-full px-3 py-2 border rounded-xl text-sm resize-none focus:outline-none"
                      style={{ borderColor: C.border, color: C.ink }}
                    />
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Btn
                        size="sm"
                        onClick={() => void send(true)}
                        disabled={sending || !draft.trim()}
                      >
                        Add internal note
                      </Btn>
                      <div className="flex-1" />
                      <Btn
                        size="sm"
                        variant="primary"
                        onClick={() => void send(false)}
                        disabled={sending || !draft.trim()}
                      >
                        {sending ? "Sending…" : "Send reply"}
                      </Btn>
                    </div>
                    {/* Stated permanently rather than discovered: without it the
                        thread reads as complete, and someone waits in here for a
                        response that arrived in a mailbox instead. */}
                    <p className="text-[11px] mt-2" style={{ color: C.muted }}>
                      Sent from info@jooma.ai. Replies arrive there and are not
                      shown here.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </Card>
      {toast}
    </>
  );
}
