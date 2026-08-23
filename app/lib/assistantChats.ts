// Client-side persistence for assistant chats.
//
// Mirrors toolRuns.ts: browser Supabase client, RLS plus the `default auth.uid()`
// column supply user_id, so it is never passed. Every function here is called
// from a "use client" component.
//
// The assistant turn is written from the client once its stream finishes, for
// the same reason ResultPanel saves tool_runs there: the route hands the
// response off before the text is complete, so the server never sees the final
// message.
import { createClient } from "@/app/lib/auth/client";
import type { ToolPrefill } from "@/app/lib/toolPrefill";

export interface AssistantChat {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface AssistantMessage {
  id: string;
  chat_id: string;
  role: "user" | "assistant";
  content: string;
  /** The prefill card this turn produced, if any. Persisted so reopening a
   *  chat still shows the card rather than losing it. */
  tool_call: ToolPrefill | null;
  created_at: string;
}

/** Chats for the sidebar, most recently active first. */
export async function listChats(): Promise<AssistantChat[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("assistant_chats")
    .select("id, title, created_at, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as AssistantChat[];
}

/** One conversation, oldest turn first. */
export async function listMessages(chatId: string): Promise<AssistantMessage[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("assistant_messages")
    .select("id, chat_id, role, content, tool_call, created_at")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AssistantMessage[];
}

/**
 * Start a chat.
 *
 * The title is derived from the opening message rather than generated: naming a
 * conversation is not worth a model call, and the first thing a teacher typed
 * is usually a better label than a summary of it would be.
 */
export async function createChat(firstMessage: string): Promise<AssistantChat> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("assistant_chats")
    .insert({ title: titleFrom(firstMessage) })
    .select("id, title, created_at, updated_at")
    .single();
  if (error) throw error;
  return data as AssistantChat;
}

export async function renameChat(id: string, title: string): Promise<void> {
  const supabase = createClient();
  const clean = title.trim().slice(0, 120) || "New chat";
  const { error } = await supabase
    .from("assistant_chats")
    .update({ title: clean })
    .eq("id", id);
  if (error) throw error;
}

/** Delete a chat. Its messages go with it via `on delete cascade`. */
export async function deleteChat(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("assistant_chats").delete().eq("id", id);
  if (error) throw error;
}

export async function saveMessage(msg: {
  chatId: string;
  role: "user" | "assistant";
  content: string;
  toolCall?: ToolPrefill | null;
}): Promise<AssistantMessage> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("assistant_messages")
    .insert({
      chat_id: msg.chatId,
      role: msg.role,
      content: msg.content,
      tool_call: msg.toolCall ?? null,
    })
    .select("id, chat_id, role, content, tool_call, created_at")
    .single();
  if (error) throw error;
  return data as AssistantMessage;
}

/**
 * A sidebar label from the opening message.
 *
 * Cut on a word boundary so a truncated title does not end mid-word, and
 * collapse newlines — a pasted multi-line brief would otherwise render as one
 * long unreadable run.
 */
function titleFrom(message: string): string {
  const flat = message.replace(/\s+/g, " ").trim();
  if (!flat) return "New chat";
  if (flat.length <= 48) return flat;
  const cut = flat.slice(0, 48);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 24 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}
