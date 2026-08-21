"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import type { AssistantChat } from "@/app/lib/assistantChats";

interface Props {
  chats: AssistantChat[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  disabled?: boolean;
}

export default function ChatSidebar({
  chats,
  activeId,
  onSelect,
  onNew,
  onRename,
  onDelete,
  disabled = false,
}: Props) {
  const [query, setQuery] = useState("");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const editRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return chats;
    return chats.filter((c) => c.title.toLowerCase().includes(q));
  }, [chats, query]);

  useEffect(() => {
    if (editingId) editRef.current?.select();
  }, [editingId]);

  const startRename = (chat: AssistantChat) => {
    setMenuFor(null);
    setEditingId(chat.id);
    setDraft(chat.title);
  };

  const commitRename = () => {
    if (!editingId) return;
    const title = draft.trim();
    const original = chats.find((c) => c.id === editingId)?.title;
    // Only write when it actually changed — an accidental blur should not
    // generate a pointless update.
    if (title && title !== original) onRename(editingId, title);
    setEditingId(null);
  };

  return (
    <aside
      className="w-[292px] shrink-0 rounded-2xl p-6 flex flex-col gap-5 overflow-hidden"
      style={{ backgroundColor: "#FAF9F5" }}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-[22px] font-medium text-dark" style={{ letterSpacing: "-0.45px" }}>
          Chats <span className="text-muted">({chats.length})</span>
        </h2>
        <button
          type="button"
          onClick={onNew}
          disabled={disabled}
          className="flex items-center gap-1.5 text-sm font-semibold text-dark transition-opacity hover:opacity-70 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          New chat
        </button>
      </div>

      <div
        className="flex items-center gap-2 rounded-xl border bg-white px-4 h-11"
        style={{ borderColor: "#F1EFE3" }}
      >
        <Search className="w-4 h-4 shrink-0 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a chat"
          aria-label="Search chats"
          className="w-full bg-transparent text-sm text-dark placeholder:text-muted focus:outline-none"
        />
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-muted shrink-0">All Chats</span>
        <div className="h-px flex-1" style={{ backgroundColor: "#EDEAE0" }} />
      </div>

      <div className="flex-1 overflow-y-auto -mx-1 px-1">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted py-2">
            {chats.length === 0 ? "No chats yet." : "No chats match that search."}
          </p>
        ) : (
          <div className="space-y-2">
            {filtered.map((chat) => {
              const active = chat.id === activeId;
              return (
                <div key={chat.id} className="relative group">
                  {editingId === chat.id ? (
                    <input
                      ref={editRef}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="w-full rounded-xl border bg-white px-4 py-3 text-[13px] text-dark focus:outline-none"
                      style={{ borderColor: "#1a1a1a" }}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSelect(chat.id)}
                      className="w-full rounded-xl px-4 py-3 pr-9 text-left text-[13px] transition-colors cursor-pointer"
                      style={{
                        backgroundColor: active ? "#1a1a1a" : "#F1EFE3",
                        color: active ? "#ffffff" : "#030303",
                      }}
                    >
                      <span className="block truncate">{chat.title}</span>
                    </button>
                  )}

                  {editingId !== chat.id && (
                    <button
                      type="button"
                      aria-label={`Options for ${chat.title}`}
                      onClick={() => setMenuFor(menuFor === chat.id ? null : chat.id)}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 transition-opacity cursor-pointer ${
                        menuFor === chat.id ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus:opacity-100"
                      }`}
                    >
                      <MoreHorizontal className={`w-4 h-4 ${active ? "text-white" : "text-muted"}`} />
                    </button>
                  )}

                  {menuFor === chat.id && (
                    <>
                      {/* Backdrop closes the menu on any outside click — the
                          pattern QuizGeneratorForm uses, and the one the two
                          slideshow menus are missing. */}
                      <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                      <div
                        className="absolute right-2 top-full z-20 mt-1 w-36 overflow-hidden rounded-lg border bg-white py-1 shadow-lg"
                        style={{ borderColor: "#EDEAE0" }}
                      >
                        <button
                          type="button"
                          onClick={() => startRename(chat)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-dark hover:bg-gray-50 cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMenuFor(null);
                            onDelete(chat.id);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
