"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { useAppShell } from "@/app/components/v2/AppShellContext";
import { createClient } from "@/app/lib/auth/client";
import ContactForm from "@/app/components/enquiry/ContactForm";
import SchoolEnquiryForm from "@/app/components/enquiry/SchoolEnquiryForm";
import Conversation from "./Conversation";
// Shared with /profile's "Submit ticket" section — see the header comment there
// for why it is one component and not two.
import NewConversation from "./NewConversation";

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

/**
 * The three ways to reach us, in one place.
 *
 * Help raises a support ticket, which a teacher answers and follows inside the
 * app. Contact and School enquiry write to `enquiries`, which staff work from
 * /admin/enquiries and answer by email. The split matters: a ticket belongs to
 * an account and a school enquiry usually does not.
 */
const TABS = [
  { id: "help", label: "Help" },
  { id: "contact", label: "Contact" },
  { id: "school", label: "School enquiry" },
] as const;

type Tab = (typeof TABS)[number]["id"];

function asTab(v: string | null | undefined): Tab {
  return v === "contact" || v === "school" ? v : "help";
}

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
  initialTab,
  knownName,
  knownEmail,
}: {
  initialThreads: MyThread[];
  initialOpenId: string | null;
  initialTab: string | null;
  knownName: string | null;
  knownEmail: string | null;
}) {
  useAppShell({
    title: "Help",
    variant: "fixed",
    banner: false,
    launcher: false,
    contentClassName: "px-4 sm:px-6 lg:px-10 pb-4 sm:pb-10 grow min-h-0",
  });

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // In the URL so a refresh keeps the tab, and so the pricing page can link
  // straight to /help?tab=school. `help` is the default and is left out of the
  // URL rather than written into it.
  const tab = asTab(searchParams.get("tab") ?? initialTab);

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

  /** href for one tab. Drops ?thread= when leaving Help, so coming back does
   *  not reopen a conversation the teacher had moved on from, and omits
   *  ?tab=help entirely so the default URL stays clean. */
  const tabHref = (id: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (id === "help") params.delete("tab");
    else {
      params.set("tab", id);
      params.delete("thread");
    }
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  return (
    /* No banner here, unlike the other app pages: the panel below is sized
       against the viewport, so a banner would push its bottom edge off screen
       rather than compressing it. Teachers still see notifications everywhere
       else, at /notifications, and in the bell. */
    <>
          {/* Real links, not buttons: these are navigations, and the URL is what
              makes a refresh, a shared link and the back button all behave.
              Same reasoning as SettingsNav on /profile. */}
          <nav
            className="inline-flex gap-1 p-1 rounded-2xl mb-4"
            style={{ backgroundColor: "var(--j-tint)" }}
            aria-label="How to reach us"
          >
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <Link
                  key={t.id}
                  href={tabHref(t.id)}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
                  style={
                    active
                      ? { backgroundColor: "var(--j-purple)", color: "#fff" }
                      : { color: "var(--j-muted)" }
                  }
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>

          {tab !== "help" ? (
            /* The forms are a single card, not a two-pane panel: there is no
               list to sit beside them. Height is left to the content rather than
               pinned to the viewport, so a long form scrolls the page normally. */
            <div
              className="rounded-3xl border p-6 sm:p-8"
              style={{ backgroundColor: "var(--j-card)", borderColor: "var(--j-line)" }}
            >
              {tab === "school" ? (
                <SchoolEnquiryForm knownName={knownName} knownEmail={knownEmail} />
              ) : (
                <ContactForm knownName={knownName} knownEmail={knownEmail} />
              )}
            </div>
          ) : (
          /* Two columns at `lg`, one below it. dvh rather than vh because
              100vh on mobile includes the collapsing URL bar, which pushed the
              panel's bottom edge below the fold. */
          <div
            className="rounded-3xl border overflow-hidden grid
              grid-cols-1 lg:grid-cols-[minmax(240px,320px)_minmax(0,1fr)]
              h-[calc(100dvh-12rem)] lg:h-[calc(100dvh-250px)] min-h-0 lg:min-h-110"
            style={{ backgroundColor: "var(--j-card)", borderColor: "var(--j-line)" }}
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
              style={{ borderColor: "var(--j-line)" }}
            >
              <div
                className="p-3 border-b shrink-0"
                style={{ borderColor: "var(--j-line)" }}
              >
                <button
                  type="button"
                  onClick={() => {
                    // openThread clears `composing`, so set it afterwards.
                    openThread(null);
                    setComposing(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold text-white cursor-pointer transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "var(--j-purple)" }}
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
                          borderColor: "var(--j-tint)",
                          backgroundColor: active ? "var(--j-tint)" : "transparent",
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm truncate grow">
                            {t.subject}
                          </span>
                          {t.has_unread && (
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: "var(--j-purple)" }}
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
                              backgroundColor: t.status === "closed" ? "var(--j-tint)" : "#E8F0E9",
                              color: t.status === "closed" ? "var(--j-faint)" : "#1f6b3b",
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
                /* The scroll well belongs to this pane, not to the composer —
                   /profile renders the same form inside a static card. */
                <div className="grow overflow-y-auto px-6 py-6 min-h-0">
                  <NewConversation
                    onCancel={threads.length > 0 ? () => setComposing(false) : undefined}
                    onCreated={async (id) => {
                      await reload();
                      openThread(id);
                    }}
                  />
                </div>
              ) : (
                <>
                  <div
                    className="px-4 sm:px-6 py-3 sm:py-4 border-b shrink-0"
                    style={{ borderColor: "var(--j-line)" }}
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
          )}
    </>
  );
}
