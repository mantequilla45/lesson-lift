"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import AppShell from "@/app/components/layout/AppShell";
import { createClient } from "@/app/lib/auth/client";
import Conversation from "./Conversation";

export interface MyThread {
  id: string;
  reference: string;
  subject: string;
  status: string;
  message_count: number;
  preview: string | null;
  last_direction: string | null;
  has_unread: boolean;
  updated_at: string;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  pending: "Waiting on us",
  closed: "Resolved",
};

function fmtRelative(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function HelpView({
  initialThreads,
  initialOpenId,
}: {
  initialThreads: MyThread[];
  initialOpenId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [threads, setThreads] = useState(initialThreads);
  // The open thread lives in the URL so it survives a refresh, is shareable,
  // and the back button does what it looks like it does.
  const openId =
    searchParams.get("thread") ??
    (initialOpenId && initialThreads.some((t) => t.id === initialOpenId)
      ? initialOpenId
      : null);
  const [composing, setComposing] = useState(initialThreads.length === 0);

  const thread = threads.find((t) => t.id === openId) ?? null;

  const reload = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.rpc("my_threads");
    setThreads((data ?? []) as MyThread[]);
    // Keeps the SideNav/TopBar unread counts honest after a send.
    router.refresh();
  }, [router]);

  const openThread = (id: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("thread", id);
    else params.delete("thread");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    setComposing(false);
  };

  return (
    /* No banner here, unlike the other app pages: the panel below is sized
       against the viewport, so a banner would push its bottom edge off screen
       rather than compressing it. Teachers still see announcements everywhere
       else and at /announcements. */
    <AppShell
      title="Help"
      variant="fixed"
      banner={false}
      launcher={false}
      contentClassName="px-4 sm:px-6 lg:px-10 pb-4 sm:pb-10 grow min-h-0"
    >
          {/* Two columns at `lg`, one below it. dvh rather than vh because
              100vh on mobile includes the collapsing URL bar, which pushed the
              panel's bottom edge below the fold. */}
          <div
            className="rounded-3xl border overflow-hidden grid
              grid-cols-1 lg:grid-cols-[minmax(240px,320px)_minmax(0,1fr)]
              h-[calc(100dvh-9rem)] lg:h-[calc(100dvh-190px)] min-h-0 lg:min-h-110"
            style={{ backgroundColor: "#FAF9F5", borderColor: "#DAD8D0" }}
          >
            {/* ── Conversation list ─────────────────────────────────────
                Below `lg` the list and the conversation are alternate views of
                the same column rather than two columns, so exactly one shows.
                Driven entirely off existing state — no new state, and the URL
                (?thread=) still drives everything, so the back button is
                unaffected. */}
            <div
              className={`lg:border-r flex-col min-h-0 ${
                composing || thread ? "hidden lg:flex" : "flex"
              }`}
              style={{ borderColor: "#DAD8D0" }}
            >
              <div
                className="p-3 border-b shrink-0"
                style={{ borderColor: "#DAD8D0" }}
              >
                <button
                  type="button"
                  onClick={() => {
                    // openThread clears `composing`, so set it afterwards.
                    openThread(null);
                    setComposing(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold text-white cursor-pointer transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "#1a1a1a" }}
                >
                  <Plus className="w-4 h-4" />
                  New conversation
                </button>
              </div>

              <div className="grow overflow-y-auto">
                {threads.length === 0 ? (
                  <p className="text-sm text-muted text-center px-4 py-8">
                    No conversations yet.
                  </p>
                ) : (
                  threads.map((t) => {
                    const active = t.id === openId && !composing;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => openThread(t.id)}
                        className="w-full text-left px-4 py-3 border-b transition-colors cursor-pointer hover:bg-black/3"
                        style={{
                          borderColor: "#EEECE4",
                          backgroundColor: active ? "#EEECE4" : "transparent",
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm truncate grow">
                            {t.subject}
                          </span>
                          {t.has_unread && (
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: "#1a1a1a" }}
                              title="New reply"
                            />
                          )}
                        </div>
                        {t.preview && (
                          <p className="text-xs text-muted mt-0.5 line-clamp-2 wrap-break-word">
                            {t.last_direction === "outbound" && "Jooma: "}
                            {t.preview}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5">
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{
                              backgroundColor: t.status === "closed" ? "#EEECE4" : "#E8F0E9",
                              color: t.status === "closed" ? "#8a8078" : "#1f6b3b",
                            }}
                          >
                            {STATUS_LABEL[t.status] ?? t.status}
                          </span>
                          <span className="text-[10px] text-muted">
                            {fmtRelative(t.updated_at)}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* ── Conversation / composer ───────────────────────────── */}
            <div
              className={`flex-col min-h-0 min-w-0 ${
                composing || thread ? "flex" : "hidden lg:flex"
              }`}
            >
              {composing || !thread ? (
                <NewConversation
                  onCancel={threads.length > 0 ? () => setComposing(false) : undefined}
                  onCreated={async (id) => {
                    await reload();
                    openThread(id);
                  }}
                />
              ) : (
                <>
                  <div
                    className="px-4 sm:px-6 py-3 sm:py-4 border-b shrink-0"
                    style={{ borderColor: "#DAD8D0" }}
                  >
                    {/* The only way back to the list on a phone, where the two
                        panes are alternate views rather than columns. */}
                    <button
                      type="button"
                      onClick={() => openThread(null)}
                      className="lg:hidden flex items-center gap-1.5 text-sm text-muted hover:text-gray-700 transition-colors mb-2 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      All conversations
                    </button>
                    <h3 className="font-semibold truncate">{thread.subject}</h3>
                    <p className="text-xs text-muted font-mono">
                      {thread.reference} · {STATUS_LABEL[thread.status] ?? thread.status}
                    </p>
                  </div>
                  <Conversation
                    threadId={thread.id}
                    status={thread.status}
                    onSent={reload}
                  />
                </>
              )}
            </div>
          </div>
    </AppShell>
  );
}

function NewConversation({
  onCancel,
  onCreated,
}: {
  onCancel?: () => void;
  onCreated: (id: string) => void;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!subject.trim() || !body.trim() || busy) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data, error: e } = await supabase.rpc("my_create_thread", {
      p_subject: subject.trim(),
      p_body: body.trim(),
    });
    setBusy(false);
    if (e) {
      setError(e.message);
      return;
    }
    onCreated(data as string);
  };

  return (
    <div className="grow overflow-y-auto px-6 py-6 min-h-0">
      <div className="max-w-xl">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1.5 text-sm text-muted hover:text-dark transition-colors mb-4 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
        )}
        <h3 className="text-xl font-medium mb-1">How can we help?</h3>
        <p className="text-sm text-muted font-light mb-5">
          Tell us what happened and we&apos;ll get back to you, usually within a
          working day.
        </p>

        {error && (
          <p className="text-sm mb-3" style={{ color: "#B3261E" }}>
            {error}
          </p>
        )}

        <label className="block text-sm font-medium mb-1.5">Subject</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
          placeholder="Ran out of resources mid-lesson"
          className="w-full px-3.5 py-2.5 border rounded-2xl bg-white text-sm mb-4 focus:outline-none focus:border-gray-400 transition-colors"
          style={{ borderColor: "#DAD8D0" }}
        />

        <label className="block text-sm font-medium mb-1.5">Message</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={7}
          maxLength={5000}
          placeholder="What were you trying to do, and what happened instead?"
          className="w-full px-3.5 py-2.5 border rounded-2xl bg-white text-sm resize-none mb-4 focus:outline-none focus:border-gray-400 transition-colors"
          style={{ borderColor: "#DAD8D0" }}
        />

        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || !subject.trim() || !body.trim()}
          className="px-5 py-2.5 rounded-2xl text-sm font-semibold text-white transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          style={{ backgroundColor: "#1a1a1a" }}
        >
          {busy ? "Sending…" : "Send message"}
        </button>
      </div>
    </div>
  );
}
