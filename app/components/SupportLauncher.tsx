"use client";

// The bottom-right "Need help?" bubble and its popover.
//
// Not built on components/Modal.tsx on purpose: that is a centred dialog with a
// full-page scrim, and the whole point of this widget is that the teacher can
// keep looking at the thing that went wrong while they describe it.
//
// Mounted next to <SideNav /> rather than in the root layout, because the root
// layout also wraps the marketing site and /admin, and a support bubble does
// not belong on either.

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, X } from "lucide-react";
import { createClient } from "@/app/lib/auth/client";
import Conversation from "@/app/help/Conversation";

interface LauncherThread {
  id: string;
  reference: string;
  subject: string;
  status: string;
  has_unread: boolean;
  preview: string | null;
  last_direction: string | null;
  updated_at: string;
}

/** Routes where a fixed bottom-right bubble would sit on top of real controls.
 *  The editor keeps its zoom controls there. */
const HIDE_ON = ["/editor", "/admin", "/login", "/signup"];

export default function SupportLauncher() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [threads, setThreads] = useState<LauncherThread[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [composing, setComposing] = useState(false);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const [{ data: rows }, { data: count }] = await Promise.all([
      supabase.rpc("my_threads"),
      supabase.rpc("my_support_unread"),
    ]);
    setThreads((rows ?? []) as LauncherThread[]);
    setUnread(Number(count ?? 0));
  }, []);

  // One count fetch per route so the dot is right before anyone opens the
  // panel, and clears once the conversation has been read.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const { data } = await supabase.rpc("my_support_unread");
      if (!cancelled) setUnread(Number(data ?? 0));
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // createPortal needs a real document, so this renders nothing during SSR.
  if (typeof document === "undefined") return null;
  if (HIDE_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  const active = threads.find((t) => t.id === openId) ?? null;

  return createPortal(
    <>
      {open && (
        <div
          className="fixed bottom-24 right-6 z-9998 flex flex-col rounded-3xl border shadow-xl overflow-hidden"
          style={{
            width: "min(380px, calc(100vw - 3rem))",
            height: "min(560px, calc(100vh - 8rem))",
            backgroundColor: "#FAF9F5",
            borderColor: "#DAD8D0",
          }}
          role="dialog"
          aria-label="Support"
        >
          <div
            className="flex items-center gap-2 px-4 py-3 border-b shrink-0"
            style={{ borderColor: "#DAD8D0" }}
          >
            {active || composing ? (
              <button
                type="button"
                onClick={() => {
                  setOpenId(null);
                  setComposing(false);
                }}
                className="text-sm text-muted hover:text-dark transition-colors cursor-pointer"
              >
                ← Back
              </button>
            ) : (
              <span className="text-sm font-semibold">Help</span>
            )}
            <div className="grow" />
            <Link
              href="/help"
              onClick={() => setOpen(false)}
              className="text-xs text-muted hover:text-dark transition-colors"
            >
              See all
            </Link>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close support"
              className="p-1 text-muted hover:text-dark transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {active ? (
            <Conversation
              threadId={active.id}
              status={active.status}
              onSent={refresh}
              compact
            />
          ) : composing ? (
            <QuickCompose
              onCreated={async (id) => {
                await refresh();
                setComposing(false);
                setOpenId(id);
              }}
            />
          ) : (
            <div className="grow overflow-y-auto min-h-0">
              {threads.length === 0 ? (
                <p className="text-sm text-muted text-center px-5 py-8">
                  No conversations yet. Start one and we&apos;ll get back to you.
                </p>
              ) : (
                threads.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setOpenId(t.id)}
                    className="w-full text-left px-4 py-3 border-b transition-colors cursor-pointer hover:bg-black/3"
                    style={{ borderColor: "#EEECE4" }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold truncate grow">
                        {t.subject}
                      </span>
                      {t.has_unread && (
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: "#1a1a1a" }}
                        />
                      )}
                    </div>
                    {t.preview && (
                      <p className="text-xs text-muted mt-0.5 line-clamp-1 wrap-break-word">
                        {t.last_direction === "outbound" && "Jooma: "}
                        {t.preview}
                      </p>
                    )}
                  </button>
                ))
              )}
            </div>
          )}

          {!active && !composing && (
            <div className="p-3 border-t shrink-0" style={{ borderColor: "#DAD8D0" }}>
              <button
                type="button"
                onClick={() => setComposing(true)}
                className="w-full px-4 py-2.5 rounded-2xl text-sm font-semibold text-white cursor-pointer transition-opacity hover:opacity-90"
                style={{ backgroundColor: "#1a1a1a" }}
              >
                New conversation
              </button>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void refresh();
        }}
        aria-label={open ? "Close support" : "Get help"}
        className="fixed bottom-6 right-6 z-9998 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white transition-transform hover:scale-105 cursor-pointer"
        style={{ backgroundColor: "#1a1a1a" }}
      >
        {open ? <X className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
        {!open && unread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 rounded-full text-[11px] font-bold flex items-center justify-center border-2"
            style={{ backgroundColor: "#B3261E", borderColor: "#F1EFE3" }}
          >
            {unread}
          </span>
        )}
      </button>
    </>,
    document.body,
  );
}

function QuickCompose({ onCreated }: { onCreated: (id: string) => void }) {
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
    <div className="grow overflow-y-auto min-h-0 px-4 py-4">
      <p className="text-sm text-muted font-light mb-4">
        Tell us what happened and we&apos;ll get back to you, usually within a
        working day.
      </p>
      {error && (
        <p className="text-xs mb-2" style={{ color: "#B3261E" }}>
          {error}
        </p>
      )}
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        maxLength={200}
        placeholder="Subject"
        className="w-full px-3.5 py-2.5 border rounded-2xl bg-white text-sm mb-3 focus:outline-none focus:border-gray-400 transition-colors"
        style={{ borderColor: "#DAD8D0" }}
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={6}
        maxLength={5000}
        placeholder="What were you trying to do, and what happened instead?"
        className="w-full px-3.5 py-2.5 border rounded-2xl bg-white text-sm resize-none mb-3 focus:outline-none focus:border-gray-400 transition-colors"
        style={{ borderColor: "#DAD8D0" }}
      />
      <button
        type="button"
        onClick={() => void submit()}
        disabled={busy || !subject.trim() || !body.trim()}
        className="w-full px-4 py-2.5 rounded-2xl text-sm font-semibold text-white transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        style={{ backgroundColor: "#1a1a1a" }}
      >
        {busy ? "Sending…" : "Send message"}
      </button>
    </div>
  );
}
