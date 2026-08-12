-- ── Teacher-facing support ───────────────────────────────────────────────────
-- The admin inbox has existed since 20260805001500_support.sql, but nothing has
-- ever been able to put a message *into* it: no code path anywhere creates a
-- row with direction = 'inbound'. The test plan opens tickets by hand-running
-- SQL. This migration gives teachers the other half of the conversation.
--
-- The whole file is shaped by one constraint, stated in the original support
-- migration and repeated here because getting it wrong is the single mistake in
-- this feature that reaches a customer:
--
--   support_messages holds internal notes (direction = 'note') in the same
--   table as teacher-visible replies. RLS is admin-only for exactly that
--   reason. Teacher access must go through a security definer RPC that filters
--   direction <> 'note' — never a direct select, never a relaxed policy.
--
-- So: no new RLS policies below. Teachers reach their own threads only through
-- the my_* functions here, each of which filters notes out at the source. The
-- preview subquery in my_threads() filters too — a note leaking through a
-- 60-character preview string is the same leak as a note in the message list.

-- ── Ticket references ────────────────────────────────────────────────────────
-- admin_create_thread built these as 'TK-' || (count(*) + 1001). reference is
-- unique, so two threads created in the same instant collide, and deleting one
-- makes the next insert reuse a live reference. That was survivable while only
-- an admin could open a ticket; it is not once teachers can. A sequence has
-- neither problem.
--
-- No backfill: support_threads is empty. If that ever stops being true, this
-- needs `setval` past the current max reference first.
create sequence if not exists support_reference_seq start 1001;

revoke all on sequence support_reference_seq from anon, public;

create or replace function next_support_reference()
returns text
language sql
volatile
security definer
set search_path = public
as $$
  select 'TK-' || lpad(nextval('support_reference_seq')::text, 4, '0');
$$;

revoke execute on function next_support_reference() from anon, public, authenticated;

-- ── Teacher-side read tracking ───────────────────────────────────────────────
-- support_threads.unread already exists but means the opposite thing: "the
-- teacher has replied and we have not answered yet". It drives the admin
-- sidebar badge. Reusing it for the teacher's own unread state would light the
-- teacher's bell at precisely the moments we owe *them* a reply, so the two
-- directions get two columns.
alter table support_threads
  add column if not exists user_last_read_at timestamptz;

-- ── The caller's own threads ─────────────────────────────────────────────────
-- Note the preview subquery's direction <> 'note' filter. Without it an
-- internal note becomes the "latest message" and is rendered as the thread
-- summary in the teacher's list.
create or replace function my_threads()
returns table (
  id            uuid,
  reference     text,
  subject       text,
  status        text,
  message_count bigint,
  preview       text,
  last_direction text,
  has_unread    boolean,
  updated_at    timestamptz,
  created_at    timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  return query
    select
      t.id, t.reference, t.subject, t.status,
      (select count(*) from support_messages m
        where m.thread_id = t.id and m.direction <> 'note'),
      (select m.body from support_messages m
        where m.thread_id = t.id and m.direction <> 'note'
        order by m.created_at desc limit 1),
      (select m.direction from support_messages m
        where m.thread_id = t.id and m.direction <> 'note'
        order by m.created_at desc limit 1),
      -- An outbound message the teacher has not seen yet.
      exists (
        select 1 from support_messages m
        where m.thread_id = t.id
          and m.direction = 'outbound'
          and (t.user_last_read_at is null or m.created_at > t.user_last_read_at)
      ),
      t.updated_at, t.created_at
    from support_threads t
    where t.user_id = auth.uid()
    order by t.updated_at desc;
end;
$$;

revoke execute on function my_threads() from anon, public;
grant execute on function my_threads() to authenticated;

-- ── One thread's messages ────────────────────────────────────────────────────
-- Ownership is re-checked here rather than trusted from the caller: this is a
-- security definer function, so a thread id belonging to someone else would
-- otherwise return their conversation.
--
-- The author column is a literal rather than the real email address. Who on the
-- team answered is internal information, and support_messages.author_id is an
-- admin's auth.users id.
create or replace function my_thread_messages(tid uuid)
returns table (
  id         uuid,
  direction  text,
  body       text,
  author     text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not exists (
    select 1 from support_threads t where t.id = tid and t.user_id = auth.uid()
  ) then
    raise exception 'no such thread';
  end if;

  return query
    select m.id, m.direction, m.body,
           case when m.direction = 'outbound' then 'Jooma' else 'You' end,
           m.created_at
    from support_messages m
    where m.thread_id = tid
      and m.direction <> 'note'
    order by m.created_at;
end;
$$;

revoke execute on function my_thread_messages(uuid) from anon, public;
grant execute on function my_thread_messages(uuid) to authenticated;

-- ── Mark a thread read (teacher side) ────────────────────────────────────────
-- Deliberately does not touch support_threads.unread: the teacher reading our
-- reply says nothing about whether we still owe them one.
--
-- Takes the caller's timestamp rather than now(). now() is transaction time, so
-- a read and a reply landing in the same instant tie on the `>` comparison in
-- my_support_unread() — and a tie resolves as "read", silently swallowing a
-- reply the teacher never saw.
--
-- The direction of the safe failure matters: a badge shown once too often is a
-- wasted click, a reply never surfaced is a teacher left waiting. So this only
-- ever moves user_last_read_at forward, and never past a message that arrived
-- after the caller loaded the thread.
create or replace function my_mark_read(tid uuid, seen_through timestamptz default null)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  update support_threads t
     set user_last_read_at = greatest(
           coalesce(t.user_last_read_at, '-infinity'::timestamptz),
           coalesce(seen_through, now())
         )
   where t.id = tid and t.user_id = auth.uid();
end;
$$;

drop function if exists my_mark_read(uuid);

revoke execute on function my_mark_read(uuid, timestamptz) from anon, public;
grant execute on function my_mark_read(uuid, timestamptz) to authenticated;

-- ── Reply to an existing thread ──────────────────────────────────────────────
create or replace function my_reply(tid uuid, p_body text)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v_id uuid; v_status text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if coalesce(trim(p_body), '') = '' then raise exception 'message body is required'; end if;
  if length(p_body) > 5000 then raise exception 'message is too long'; end if;

  select status into v_status
    from support_threads
   where id = tid and user_id = auth.uid();
  if v_status is null then raise exception 'no such thread'; end if;

  insert into support_messages (thread_id, author_id, direction, body)
  values (tid, auth.uid(), 'inbound', p_body)
  returning id into v_id;

  -- Replying to a resolved ticket reopens it — otherwise a teacher whose
  -- problem came back would be typing into a closed thread nobody triages.
  -- touch_support_thread() already bumps updated_at and sets unread for
  -- inbound messages, so neither is repeated here.
  if v_status = 'closed' then
    update support_threads
       set status = 'open', closed_at = null
     where id = tid;
  end if;

  return v_id;
end;
$$;

revoke execute on function my_reply(uuid, text) from anon, public;
grant execute on function my_reply(uuid, text) to authenticated;

-- ── Open a new thread ────────────────────────────────────────────────────────
-- Priority comes from the plan's prioritySupport entitlement (app/lib/plans.ts),
-- which every plan has declared since it was written and no code has ever read.
-- free is the only plan without it.
create or replace function my_create_thread(p_subject text, p_body text)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v_id uuid; v_ref text; v_school uuid; v_plan text; v_open int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if coalesce(trim(p_subject), '') = '' then raise exception 'subject is required'; end if;
  if coalesce(trim(p_body), '') = '' then raise exception 'message body is required'; end if;
  if length(p_subject) > 200 then raise exception 'subject is too long'; end if;
  if length(p_body) > 5000 then raise exception 'message is too long'; end if;

  -- Cheap abuse guard. A teacher with ten unresolved tickets is not being
  -- helped by an eleventh, and this is the one write on the table reachable by
  -- a non-admin.
  select count(*) into v_open
    from support_threads
   where user_id = auth.uid() and status <> 'closed';
  if v_open >= 10 then
    raise exception 'you already have several open conversations — please reply to one of those';
  end if;

  select school_id, plan into v_school, v_plan from profiles where id = auth.uid();

  v_ref := next_support_reference();

  insert into support_threads (
    reference, user_id, school_id, subject, priority, unread, user_last_read_at
  )
  values (
    v_ref, auth.uid(), v_school, p_subject,
    case when coalesce(v_plan, 'free') = 'free' then 'normal' else 'high' end,
    true,
    -- The teacher has by definition read their own opening message.
    now()
  )
  returning id into v_id;

  insert into support_messages (thread_id, author_id, direction, body)
  values (v_id, auth.uid(), 'inbound', p_body);

  return v_id;
end;
$$;

revoke execute on function my_create_thread(text, text) from anon, public;
grant execute on function my_create_thread(text, text) to authenticated;

-- ── Unread count for the bell ────────────────────────────────────────────────
create or replace function my_support_unread()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(count(*), 0)::integer
  from support_threads t
  where t.user_id = auth.uid()
    and exists (
      select 1 from support_messages m
      where m.thread_id = t.id
        and m.direction = 'outbound'
        and (t.user_last_read_at is null or m.created_at > t.user_last_read_at)
    );
$$;

revoke execute on function my_support_unread() from anon, public;
grant execute on function my_support_unread() to authenticated;

-- ── Point admin_create_thread at the sequence too ────────────────────────────
-- Same body as 20260805001600_admin_support_rpcs.sql apart from the reference
-- line; replaced wholesale because that is how the RPC files in this repo are
-- maintained.
create or replace function admin_create_thread(
  uid uuid, p_subject text, p_body text, p_priority text default 'normal'
)
returns uuid
language plpgsql volatile security definer set search_path = public
as $$
declare v_id uuid; v_ref text; v_school uuid;
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  if coalesce(trim(p_subject), '') = '' then raise exception 'subject is required'; end if;

  select school_id into v_school from profiles where id = uid;

  v_ref := next_support_reference();

  insert into support_threads (reference, user_id, school_id, subject, priority, assigned_to, unread)
  values (v_ref, uid, v_school, p_subject, coalesce(p_priority, 'normal'), auth.uid(), false)
  returning id into v_id;

  if coalesce(trim(p_body), '') <> '' then
    insert into support_messages (thread_id, author_id, direction, body)
    values (v_id, auth.uid(), 'outbound', p_body);
    update support_threads set unread = false where id = v_id;
  end if;

  perform admin_log('Opened ticket', 'other', 'support_thread', v_id::text, v_ref,
    jsonb_build_object('subject', p_subject, 'user_id', uid));

  return v_id;
end;
$$;
revoke execute on function admin_create_thread(uuid, text, text, text) from anon, public;
grant execute on function admin_create_thread(uuid, text, text, text) to authenticated;

-- ── Email template row ───────────────────────────────────────────────────────
-- Subject line and the live/paused switch live in the table so support wording
-- can change without a deploy; the HTML body is in code
-- (app/lib/email-templates/supportReply.ts). Guarded insert so re-running is
-- safe, matching the seed style used elsewhere.
insert into email_templates (key, name, trigger_description, subject, live)
select 'support_reply', 'Support reply',
       'Sent to a teacher when support replies to their conversation. Internal notes never trigger this.',
       'Re: {{subject}}', true
where not exists (select 1 from email_templates where key = 'support_reply');
