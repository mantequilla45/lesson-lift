-- ── Support inbox ────────────────────────────────────────────────────────────
-- Conversations with teachers. Three message directions, and the distinction
-- between them is the whole point of the table:
--
--   inbound  — from the teacher
--   outbound — from us, the teacher sees it
--   note     — internal, the teacher must NEVER see it
--
-- The `note` direction is why RLS on support_messages is admin-only rather than
-- owner-scoped: a teacher reading their own thread would otherwise read the
-- internal notes on it too. Teacher-facing access, when it exists, must go
-- through a view or RPC that filters direction <> 'note', never a direct
-- select. That is deliberately not built here.

create table if not exists support_threads (
  id          uuid primary key default gen_random_uuid(),
  -- Human reference shown to both sides, e.g. TK-1042.
  reference   text not null unique,
  user_id     uuid references auth.users(id) on delete set null,
  school_id   uuid references schools(id) on delete set null,
  subject     text not null,
  status      text not null default 'open' check (status in ('open','pending','closed')),
  priority    text not null default 'normal' check (priority in ('low','normal','high')),
  assigned_to uuid references auth.users(id) on delete set null,
  -- True when the teacher has replied since we last looked.
  unread      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  closed_at   timestamptz
);

create index if not exists support_threads_status_idx
  on support_threads (status, updated_at desc);
create index if not exists support_threads_user_idx
  on support_threads (user_id, updated_at desc);

alter table support_threads enable row level security;

drop policy if exists "admins manage threads" on support_threads;
create policy "admins manage threads" on support_threads
  for all using (is_admin()) with check (is_admin());

create table if not exists support_messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references support_threads(id) on delete cascade,
  author_id  uuid references auth.users(id) on delete set null,
  direction  text not null check (direction in ('inbound','outbound','note')),
  body       text not null,
  created_at timestamptz not null default now()
);

create index if not exists support_messages_thread_idx
  on support_messages (thread_id, created_at);

alter table support_messages enable row level security;

-- Admin-only in both directions. See the header comment: internal notes live in
-- this table, so there is no safe owner-scoped read policy.
drop policy if exists "admins manage messages" on support_messages;
create policy "admins manage messages" on support_messages
  for all using (is_admin()) with check (is_admin());

-- ── Canned replies ───────────────────────────────────────────────────────────
-- The answers support gives over and over. Kept in the database so wording can
-- be fixed without a deploy, and so the same phrasing is used by everyone.
create table if not exists canned_replies (
  key        text primary key,
  label      text not null,
  body       text not null,
  sort       integer not null default 0,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table canned_replies enable row level security;

drop policy if exists "admins manage canned replies" on canned_replies;
create policy "admins manage canned replies" on canned_replies
  for all using (is_admin()) with check (is_admin());

-- Seeded from the console spec. Deliberately plain-spoken: these are read by
-- teachers mid-lesson, so they lead with the fix rather than an apology.
insert into canned_replies (key, label, body, sort)
select * from (values
  ('out_of_resources', 'Out of resources',
   'You''ve used this month''s resources. I''ve added 100 to your account so you''re not stuck — they''ll be there next time you refresh. Your allowance resets on the 1st.', 1),
  ('ai_images_used', 'AI images used up',
   'You''ve used your AI-generated slideshow images for this month. Slideshows using our free image library are still unlimited, and most teachers can''t tell the difference on a whiteboard. If you''d rather keep the AI ones, a pack of 10 is £2.99, or Max includes 25 a month.', 2),
  ('offer_annual', 'Offer annual',
   'Before you go — the annual plan is £79 for the year, which works out cheaper than ten monthly payments and covers you right through to next summer. No pause needed over the holidays. Want me to switch you over?', 3),
  ('card_failed', 'Card failed',
   'Your card was declined by your bank rather than by us, which usually means a security check wasn''t completed. Here''s a secure link to re-enter your card — it takes about 30 seconds and nothing else changes: [link]', 4),
  ('invite_not_received', 'Invite not received',
   'Your invite bounced, which normally means your school''s email filter blocked it. I''ve re-sent it now. If it still doesn''t arrive, ask your IT lead to allow jooma.ai — instructions here: [link]', 5),
  ('known_bug', 'Known bug',
   'Thanks for flagging this — you''re right, and it''s a bug on our side rather than anything you''ve done. It''s with the developers now and I''ll come back to you the moment it''s fixed.', 6)
) as v(key, label, body, sort)
where not exists (select 1 from canned_replies);

-- ── Keep threads sorted by real activity ─────────────────────────────────────
-- updated_at drives the inbox order, so it has to move when a message lands
-- rather than only when the thread row itself is edited.
create or replace function touch_support_thread()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update support_threads
     set updated_at = now(),
         -- A teacher reply reopens the unread flag; our own replies and
         -- internal notes do not.
         unread = case when new.direction = 'inbound' then true else unread end
   where id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists support_messages_touch on support_messages;
create trigger support_messages_touch
  after insert on support_messages
  for each row execute function touch_support_thread();

-- Trigger functions are invoked by Postgres, never over the API. This one
-- inherited the default PUBLIC execute grant, which made it reachable by anon
-- via /rest/v1/rpc/. Calling it outside a trigger context would fail (no NEW
-- record), but there is no reason to expose it at all.
revoke execute on function touch_support_thread() from anon, public, authenticated;
