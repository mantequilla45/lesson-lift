"use client";

// The assistant's persistent frame: chrome, the chat list, and the actions that
// operate on it.
//
// This lives in app/assistant/layout.tsx rather than in the page, which is the
// whole point. /assistant and /assistant/[id] are separate route segments, so
// anything held in the page is torn down and rebuilt on every chat click —
// the sidebar would refetch from Supabase and, while that was in flight, render
// "Chats (0) / No chats yet." over a list the teacher had just clicked. In a
// layout the sidebar is never unmounted, so navigating swaps only the message
// panel. See docs/instant-navigation-guide.md section 3.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import AppShellV2 from "@/app/components/v2/AppShellV2";
import UpgradeGate from "@/app/components/UpgradeGate";
import ConfirmModal from "@/app/components/ConfirmModal";
import ChatSidebar from "@/app/components/assistant/ChatSidebar";
import {
  deleteChat,
  listChats,
  renameChat,
  type AssistantChat,
} from "@/app/lib/assistantChats";
import { getEntitlements } from "@/app/lib/entitlements";
import { can } from "@/app/lib/plans";

interface AssistantChatsValue {
  /** Add a chat created by the page, so the sidebar shows it immediately. */
  addChat: (chat: AssistantChat) => void;
  /** Re-read the list from the server. */
  refreshChats: () => void;
  /** null while the plan is still being resolved — see below. */
  allowed: boolean | null;
}

const AssistantChatsContext = createContext<AssistantChatsValue | null>(null);

/**
 * The seam between the layout's chat list and the page's conversation.
 *
 * Only what the page genuinely has to push upward: a chat is created on its
 * first message, and the sidebar has to learn about it. Everything else the
 * page needs (which chat is open) is already in the URL.
 */
export function useAssistantChats(): AssistantChatsValue {
  const ctx = useContext(AssistantChatsContext);
  if (!ctx) throw new Error("useAssistantChats must be used inside AssistantShell");
  return ctx;
}

export default function AssistantShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  // null = not loaded yet, [] = genuinely empty. Without the distinction the
  // sidebar renders "No chats yet." during every load, which is the bug this
  // component exists to fix. Mirrors the `allowed` sentinel below.
  const [chats, setChats] = useState<AssistantChat[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // null = still loading. Rendering the composer before we know the plan would
  // flash an enabled input at a Free user and then disable it.
  const [allowed, setAllowed] = useState<boolean | null>(null);

  // The open chat, derived from the URL rather than stored. /assistant/<id> is
  // already the source of truth; duplicating it in state would mean a write on
  // every navigation and two things to keep in step.
  const activeId = useMemo(() => {
    const match = /^\/assistant\/([^/]+)/.exec(pathname ?? "");
    return match ? decodeURIComponent(match[1]) : null;
  }, [pathname]);

  const refreshChats = useCallback(() => {
    listChats()
      .then((rows) => {
        setChats(rows);
        setLoadFailed(false);
      })
      .catch(() => {
        // Distinguished from an empty list. Collapsing a failed load into []
        // told the teacher their chats did not exist.
        setChats([]);
        setLoadFailed(true);
      });
  }, []);

  useEffect(() => {
    getEntitlements()
      .then((e) => setAllowed(can(e.plan, "assistant")))
      // Fail open in the UI only. proxy.ts is the real gate, so the worst case
      // is a Free user seeing an enabled composer and getting the upgrade modal
      // on send — far better than locking out a paying teacher over a blip.
      .catch(() => setAllowed(true));
  }, []);

  useEffect(() => {
    refreshChats();
  }, [refreshChats]);

  const addChat = useCallback((chat: AssistantChat) => {
    setChats((prev) => [chat, ...(prev ?? [])]);
  }, []);

  const handleDelete = async (id: string) => {
    setChats((prev) => (prev ?? []).filter((c) => c.id !== id));
    setDeleting(null);
    try {
      await deleteChat(id);
    } catch {
      // Put it back rather than leave the sidebar lying about what exists.
      refreshChats();
      return;
    }
    if (id === activeId) router.replace("/assistant");
  };

  const handleRename = async (id: string, title: string) => {
    setChats((prev) => (prev ?? []).map((c) => (c.id === id ? { ...c, title } : c)));
    try {
      await renameChat(id, title);
    } catch {
      refreshChats();
    }
  };

  const locked = allowed === false;

  const value = useMemo(
    () => ({ addChat, refreshChats, allowed }),
    [addChat, refreshChats, allowed],
  );

  return (
    <>
      {/* UpgradeGate catches the 402 from a spend ceiling or the plan gate and
          opens the upgrade/top-up modal. Not inherited from a layout —
          /assistant is a sibling of /tools, not inside it. */}
      <AppShellV2
        title="Ask Mo"
        variant="fixed"
        slot={<UpgradeGate />}
        /* Stacks below `lg`: two fixed sidebars (the 256px rail plus this
           292px chat list) left the conversation at negative width on a
           phone. */
        contentClassName="flex flex-1 flex-col lg:flex-row gap-3 overflow-hidden px-4 sm:px-6 lg:px-10 pb-5 min-h-0"
      >
          <ChatSidebar
            chats={chats ?? []}
            loading={chats === null}
            loadFailed={loadFailed}
            onRetry={refreshChats}
            activeId={activeId}
            onSelect={(id) => router.push(`/assistant/${id}`)}
            onNew={() => router.push("/assistant")}
            onRename={handleRename}
            onDelete={(id) => setDeleting(id)}
            disabled={locked}
          />

          <AssistantChatsContext.Provider value={value}>
            {children}
          </AssistantChatsContext.Provider>
      </AppShellV2>

      <ConfirmModal
        open={deleting !== null}
        title="Delete this chat?"
        message="This removes the conversation and its messages. It can't be undone."
        confirmLabel="Delete"
        onConfirm={() => deleting && handleDelete(deleting)}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
