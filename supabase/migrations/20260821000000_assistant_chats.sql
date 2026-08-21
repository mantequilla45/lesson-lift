-- AI assistant: persistent chat history.
--
-- Modelled on tool_runs (20260531000000), NOT on support_threads. The support
-- tables are admin-only at the RLS layer because internal 'note' messages share
-- the table with teacher-visible ones, so teachers reach them through
-- SECURITY DEFINER my_* RPCs. Nothing of the sort applies here: an assistant
-- chat belongs to exactly one teacher and no staff content lives alongside it,
-- so plain owner-scoped RLS is both correct and much simpler.

create table if not exists assistant_chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists assistant_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references assistant_chats (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  -- The prefill card this turn produced, when the assistant routed the teacher
  -- into a tool: { slug, fields }. Null on ordinary conversational turns.
  -- Stored so reopening a chat still shows the card rather than losing it.
  tool_call jsonb,
  created_at timestamptz not null default now()
);

alter table assistant_chats enable row level security;
alter table assistant_messages enable row level security;

-- Sidebar ordering: most recently active chat first.
create index if not exists assistant_chats_user_idx
  on assistant_chats (user_id, updated_at desc);

-- Loading one conversation, oldest turn first.
create index if not exists assistant_messages_chat_idx
  on assistant_messages (chat_id, created_at);

-- Covering index for the FK, per the convention established in
-- 20260805002000_rls_performance.sql.
create index if not exists assistant_messages_user_idx
  on assistant_messages (user_id);

-- Owner-scoped policies.
--
-- auth.uid() is wrapped in a scalar subselect throughout. Postgres then
-- evaluates it once per query instead of once per row — the mandatory idiom
-- from 20260805002000_rls_performance.sql, and the difference between an index
-- scan and a sequential one on a chat with hundreds of turns.
create policy "own chats read" on assistant_chats
  for select using ((select auth.uid()) = user_id);
create policy "own chats insert" on assistant_chats
  for insert with check ((select auth.uid()) = user_id);
create policy "own chats update" on assistant_chats
  for update using ((select auth.uid()) = user_id);
create policy "own chats delete" on assistant_chats
  for delete using ((select auth.uid()) = user_id);

create policy "own messages read" on assistant_messages
  for select using ((select auth.uid()) = user_id);
create policy "own messages insert" on assistant_messages
  for insert with check ((select auth.uid()) = user_id);
create policy "own messages delete" on assistant_messages
  for delete using ((select auth.uid()) = user_id);
-- No update policy: a sent message is a historical record. Renaming a chat
-- updates assistant_chats.title, never a message body.

grant select, insert, update, delete on assistant_chats to authenticated;
grant select, insert, delete on assistant_messages to authenticated;

-- Keep assistant_chats.updated_at tracking real activity, so the sidebar sorts
-- by when a conversation was last used rather than when it was created.
-- Mirrors touch_support_thread() in 20260805001500_support.sql.
create or replace function touch_assistant_chat()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update assistant_chats
     set updated_at = now()
   where id = new.chat_id;
  return new;
end;
$$;

drop trigger if exists assistant_messages_touch on assistant_messages;
create trigger assistant_messages_touch
  after insert on assistant_messages
  for each row execute function touch_assistant_chat();

-- Register the assistant with the admin model console so its model can be
-- retargeted without a deploy. Seeded to the same literals the route passes as
-- its modelFor() fallback, making this row a no-op until an admin changes it.
--
-- gpt-5.6-luna: chat is the highest-volume, most multi-turn surface in the
-- product, and luna is ~10x cheaper than terra ($0.20/$1.20 vs $2/$12 per 1M).
-- effort/verbosity are set because luna IS a reasoning model — unlike the
-- gpt-4o rows in this table, which leave both null. 'low' effort keeps replies
-- conversational rather than slow.
--
-- kind = 'utility', matching the other non-grid AI routes: `kind='tool'` means
-- a teacher picks it from the tools grid, and the assistant is reached from the
-- sidebar instead. enabled stays true — switching it off would be a product
-- decision, but the kill switch works via toolSlugFor('assistant') if needed.
insert into tool_settings (slug, display_name, enabled, kind, model, effort, verbosity)
values ('assistant', 'AI assistant', true, 'utility', 'gpt-5.6-luna', 'low', 'medium')
on conflict (slug) do update
  set display_name = excluded.display_name,
      kind         = excluded.kind,
      model        = coalesce(tool_settings.model, excluded.model),
      effort       = coalesce(tool_settings.effort, excluded.effort),
      verbosity    = coalesce(tool_settings.verbosity, excluded.verbosity);

-- The guardrail classifier is a separate, much cheaper call (a one-token yes/no
-- on gpt-4o-mini). It gets its own row so an admin can see and retune it
-- independently of the model that writes the answers.
insert into tool_settings (slug, display_name, enabled, kind, model)
values ('assistant-guardrail', 'AI assistant — topic check', true, 'utility', 'gpt-4o-mini')
on conflict (slug) do nothing;
