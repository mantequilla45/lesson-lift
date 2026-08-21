"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import SideNav from "@/app/components/layout/SideNav";
import SupportLauncher from "@/app/components/SupportLauncher";
import TopBar from "@/app/components/layout/TopBar";
import AnnouncementBanner from "@/app/components/AnnouncementBanner";
import UpgradeGate from "@/app/components/UpgradeGate";
import ConfirmModal from "@/app/components/ConfirmModal";
import ChatSidebar from "@/app/components/assistant/ChatSidebar";
import ChatMessages, { type ChatTurn } from "@/app/components/assistant/ChatMessages";
import AssistantComposer, { type Attachment } from "@/app/components/assistant/AssistantComposer";
import AssistantLocked from "@/app/components/assistant/AssistantLocked";
import {
  createChat,
  deleteChat,
  listChats,
  listMessages,
  renameChat,
  saveMessage,
  type AssistantChat,
} from "@/app/lib/assistantChats";
import { validatePrefill, type ToolPrefill } from "@/app/lib/toolPrefill";
import { getEntitlements } from "@/app/lib/entitlements";
import { can } from "@/app/lib/plans";

/** Header the route uses to hand back a prefill decision alongside the stream. */
const TOOL_HEADER = "x-assistant-tool";

export default function AssistantView({ chatId }: { chatId?: string }) {
  const router = useRouter();

  const [chats, setChats] = useState<AssistantChat[]>([]);
  const [activeId, setActiveId] = useState<string | null>(chatId ?? null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  /** A stored user message still awaiting its reply — see the loader below. */
  const [pendingReply, setPendingReply] = useState<string | null>(null);

  // null = still loading. Rendering the composer before we know the plan would
  // flash an enabled input at a Free user and then disable it.
  const [allowed, setAllowed] = useState<boolean | null>(null);

  // The live turns, readable from inside the streaming loop without making it a
  // dependency — otherwise every token would rebuild the send callback.
  const turnsRef = useRef<ChatTurn[]>([]);
  turnsRef.current = turns;

  useEffect(() => {
    getEntitlements()
      .then((e) => setAllowed(can(e.plan, "assistant")))
      // Fail open in the UI only. proxy.ts is the real gate, so the worst case
      // is a Free user seeing an enabled composer and getting the upgrade modal
      // on send — far better than locking out a paying teacher over a blip.
      .catch(() => setAllowed(true));
  }, []);

  useEffect(() => {
    listChats().then(setChats).catch(() => setChats([]));
  }, []);

  // Load the conversation whenever the route changes.
  //
  // A chat arriving from the dashboard card has one stored user message and no
  // reply — the card creates the chat and hands off rather than streaming
  // itself. Detecting that here (rather than passing a flag through the URL)
  // means a refresh mid-answer resumes correctly too.
  useEffect(() => {
    if (!chatId) {
      setActiveId(null);
      setTurns([]);
      return;
    }
    setActiveId(chatId);
    listMessages(chatId)
      .then((rows) => {
        setTurns(
          rows.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            toolCall: m.tool_call,
          })),
        );
        const last = rows[rows.length - 1];
        if (last?.role === "user") setPendingReply(last.content);
      })
      .catch(() => setTurns([]));
  }, [chatId]);

  /**
   * Stream one reply for a conversation that already ends in a user turn.
   *
   * Shared by the composer and by the pending-reply loader, so a chat started
   * from the dashboard is answered by exactly the same code as one typed here.
   */
  const streamReply = useCallback(
    async (
      chatIdForSave: string,
      history: ChatTurn[],
      opts: { level: string | null; tone: string | null; attachment: Attachment | null },
    ) => {
      const replyId = `local-reply-${Date.now()}`;
      setTurns([...history, { id: replyId, role: "assistant", content: "" }]);
      setStreaming(true);

      let reply = "";
      let toolCall: ToolPrefill | null = null;

      try {
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history.map((t) => ({ role: t.role, content: t.content })),
            level: opts.level,
            tone: opts.tone,
            attachment: opts.attachment,
          }),
        });

        if (!res.ok) {
          // 402 is handled by UpgradeGate, which patches window.fetch and opens
          // the upgrade modal itself. Drop the placeholder and say nothing more.
          if (res.status === 402) {
            setTurns(history);
            return;
          }
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "The assistant is unavailable right now.");
        }

        const header = res.headers.get(TOOL_HEADER);
        if (header) {
          try {
            // Re-validated client-side: a header is not a trusted channel, and
            // this is what decides which tool page we link to.
            toolCall = validatePrefill(JSON.parse(atob(header)));
          } catch {
            toolCall = null;
          }
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          reply += decoder.decode(value, { stream: true });
          setTurns([...history, { id: replyId, role: "assistant", content: reply, toolCall }]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setTurns(history);
        return;
      } finally {
        setStreaming(false);
      }

      if (reply.trim()) {
        void saveMessage({ chatId: chatIdForSave, role: "assistant", content: reply, toolCall }).catch(
          () => {},
        );
      }
    },
    [],
  );

  const send = useCallback(
    async (
      message: string,
      opts: { level: string | null; tone: string | null; attachment: Attachment | null },
    ) => {
      setError(null);

      // Create the chat on the first message rather than up front, so opening
      // /assistant and leaving never litters the sidebar with empty chats.
      let id = activeId;
      let isNew = false;
      if (!id) {
        try {
          const chat = await createChat(message);
          id = chat.id;
          isNew = true;
          setActiveId(chat.id);
          setChats((prev) => [chat, ...prev]);
        } catch {
          setError("Couldn't start that chat. Please try again.");
          return;
        }
      }

      // Optimistic: the teacher's own words appear instantly.
      const userTurn: ChatTurn = { id: `local-user-${Date.now()}`, role: "user", content: message };
      const history = [...turnsRef.current, userTurn];

      void saveMessage({ chatId: id, role: "user", content: message }).catch(() => {
        /* The turn is already on screen and in the request; a failed history
           write must not interrupt the reply the teacher is waiting for. */
      });

      await streamReply(id, history, opts);

      // Deferred to here so the URL changes once the exchange is complete,
      // rather than remounting mid-stream.
      if (isNew) router.replace(`/assistant/${id}`);
    },
    [activeId, router, streamReply],
  );

  // Answer a chat that arrived with its opening message already stored — the
  // dashboard card's hand-off, or a refresh that landed between the user turn
  // being saved and its reply arriving.
  useEffect(() => {
    if (!pendingReply || !activeId || streaming) return;
    setPendingReply(null);
    void streamReply(activeId, turnsRef.current, { level: null, tone: null, attachment: null });
  }, [pendingReply, activeId, streaming, streamReply]);

  const handleDelete = async (id: string) => {
    setChats((prev) => prev.filter((c) => c.id !== id));
    setDeleting(null);
    try {
      await deleteChat(id);
    } catch {
      // Put it back rather than leave the sidebar lying about what exists.
      listChats().then(setChats).catch(() => {});
      return;
    }
    if (id === activeId) router.replace("/assistant");
  };

  const handleRename = async (id: string, title: string) => {
    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
    try {
      await renameChat(id, title);
    } catch {
      listChats().then(setChats).catch(() => {});
    }
  };

  const locked = allowed === false;

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "#F1EFE3" }}>
      {/* Catches the 402 from a spend ceiling or the plan gate and opens the
          upgrade/top-up modal. Not inherited from a layout — /assistant is a
          sibling of /tools, not inside it. */}
      <UpgradeGate />
      <SideNav />
      <SupportLauncher />

      <main className="grow flex flex-col overflow-hidden h-screen">
        <TopBar title="AI assistant" />
        <AnnouncementBanner />

        <div className="flex flex-1 gap-3 overflow-hidden px-10 pb-5">
          <ChatSidebar
            chats={chats}
            activeId={activeId}
            onSelect={(id) => router.push(`/assistant/${id}`)}
            onNew={() => router.push("/assistant")}
            onRename={handleRename}
            onDelete={(id) => setDeleting(id)}
            disabled={locked}
          />

          <section
            className="flex flex-1 flex-col overflow-hidden rounded-2xl"
            style={{ backgroundColor: "#FAF9F5" }}
          >
            {locked ? (
              <AssistantLocked />
            ) : (
              <>
                {turns.length === 0 ? <EmptyState /> : <ChatMessages turns={turns} streaming={streaming} />}

                <div className="px-10 pb-8 pt-2">
                  {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
                  <AssistantComposer
                    onSend={send}
                    busy={streaming}
                    disabled={allowed === null}
                    autoFocus
                    placeholder="Try: 'Create a Year 5 multiplication quiz'"
                  />
                </div>
              </>
            )}
          </section>
        </div>
      </main>

      <ConfirmModal
        open={deleting !== null}
        title="Delete this chat?"
        message="This removes the conversation and its messages. It can't be undone."
        confirmLabel="Delete"
        onConfirm={() => deleting && handleDelete(deleting)}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

/**
 * The empty state.
 *
 * No clickable starter prompts: they put words in a teacher's mouth and the
 * ones that fit are rarely the ones they need. Instead this says what the
 * assistant can do and how to phrase a request, which is the part that actually
 * helps someone who has not used it before.
 */
function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-10 text-center">
      <h2
        className="text-[32px] font-semibold text-dark"
        style={{ letterSpacing: "0.38px" }}
      >
        How can I help you?
      </h2>
      <p className="mt-4 max-w-md text-sm text-muted">
        Ask about planning, assessment, behaviour, SEND, or anything else in your
        teaching week.
      </p>
      <p className="mt-2 max-w-md text-sm text-muted">
        Ask for a resource — a lesson plan, worksheet, quiz or letter — and I&apos;ll
        open the right tool with the details filled in. Mention the year group and
        subject and there will be less to correct.
      </p>
    </div>
  );
}
