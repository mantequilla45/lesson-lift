-- ── Support inbox RPCs ───────────────────────────────────────────────────────

-- Thread list for the left pane. Carries a preview of the latest message and
-- the teacher's plan so the list is triageable without opening anything.
create or replace function admin_threads(
  p_status text default null,
  p_filter text default null,   -- 'mine' | 'unassigned' | null
  q        text default null
)
returns table (
  id            uuid,
  reference     text,
  user_id       uuid,
  teacher       text,
  email         text,
  school_name   text,
  plan          text,
  subject       text,
  status        text,
  priority      text,
  assigned_to   uuid,
  assignee      text,
  unread        boolean,
  message_count bigint,
  preview       text,
  last_direction text,
  updated_at    timestamptz,
  created_at    timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    select
      t.id, t.reference, t.user_id,
      coalesce(nullif(trim(coalesce(p.first_name,'') || ' ' || coalesce(p.surname,'')), ''),
               u.email::text, 'Unknown'),
      u.email::text,
      sc.name,
      coalesce(p.plan, 'free'),
      t.subject, t.status, t.priority, t.assigned_to,
      au.email::text,
      t.unread,
      (select count(*) from support_messages m where m.thread_id = t.id),
      (select m.body from support_messages m
        where m.thread_id = t.id order by m.created_at desc limit 1),
      (select m.direction from support_messages m
        where m.thread_id = t.id order by m.created_at desc limit 1),
      t.updated_at, t.created_at
    from support_threads t
    left join auth.users u  on u.id = t.user_id
    left join profiles p    on p.id = t.user_id
    left join schools sc    on sc.id = t.school_id
    left join auth.users au on au.id = t.assigned_to
    where (p_status is null or p_status = '' or t.status = p_status)
      and (p_filter is null or p_filter = ''
           or (p_filter = 'mine' and t.assigned_to = auth.uid())
           or (p_filter = 'unassigned' and t.assigned_to is null))
      and (q is null or q = ''
           or t.subject ilike '%' || q || '%'
           or t.reference ilike '%' || q || '%'
           or u.email::text ilike '%' || q || '%')
    order by
      -- Open and high-priority first; the inbox should surface what needs
      -- doing, not just what changed most recently.
      case t.status when 'open' then 0 when 'pending' then 1 else 2 end,
      case t.priority when 'high' then 0 when 'normal' then 1 else 2 end,
      t.updated_at desc;
end;
$$;
revoke execute on function admin_threads(text, text, text) from anon, public;
grant execute on function admin_threads(text, text, text) to authenticated;

-- Full message history for one thread, including internal notes.
create or replace function admin_thread_messages(tid uuid)
returns table (
  id         uuid,
  direction  text,
  body       text,
  author     text,
  created_at timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    select m.id, m.direction, m.body, u.email::text, m.created_at
    from support_messages m
    left join auth.users u on u.id = m.author_id
    where m.thread_id = tid
    order by m.created_at;
end;
$$;
revoke execute on function admin_thread_messages(uuid) from anon, public;
grant execute on function admin_thread_messages(uuid) to authenticated;

-- Post a reply or an internal note. `is_note` is the one flag that decides
-- whether the teacher ever sees this text.
create or replace function admin_reply(tid uuid, p_body text, is_note boolean default false)
returns uuid
language plpgsql volatile security definer set search_path = public
as $$
declare v_id uuid; v_ref text;
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  if coalesce(trim(p_body), '') = '' then raise exception 'message body is required'; end if;

  select reference into v_ref from support_threads where id = tid;
  if v_ref is null then raise exception 'no such thread'; end if;

  insert into support_messages (thread_id, author_id, direction, body)
  values (tid, auth.uid(), case when is_note then 'note' else 'outbound' end, p_body)
  returning id into v_id;

  -- Replying clears the unread flag; adding a private note does not, because
  -- the teacher is still waiting on an actual answer.
  if not is_note then
    update support_threads set unread = false where id = tid;
  end if;

  perform admin_log(
    case when is_note then 'Added internal note' else 'Replied to ticket' end,
    'other', 'support_thread', tid::text, v_ref,
    jsonb_build_object('is_note', is_note)
  );

  return v_id;
end;
$$;
revoke execute on function admin_reply(uuid, text, boolean) from anon, public;
grant execute on function admin_reply(uuid, text, boolean) to authenticated;

create or replace function admin_set_thread(tid uuid, payload jsonb)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare v_ref text; v_status text;
begin
  if not is_admin() then raise exception 'not authorized'; end if;

  v_status := nullif(payload->>'status', '');
  if v_status is not null and v_status not in ('open','pending','closed') then
    raise exception 'invalid status';
  end if;

  update support_threads set
    status      = coalesce(v_status, status),
    priority    = coalesce(nullif(payload->>'priority', ''), priority),
    assigned_to = case
                    when payload ? 'assign_to_me' and (payload->>'assign_to_me')::boolean
                      then auth.uid()
                    when payload ? 'unassign' and (payload->>'unassign')::boolean
                      then null
                    else assigned_to
                  end,
    unread      = case when payload ? 'read' and (payload->>'read')::boolean
                       then false else unread end,
    closed_at   = case when v_status = 'closed' then now()
                       when v_status is not null then null
                       else closed_at end,
    updated_at  = now()
  where id = tid
  returning reference into v_ref;

  if v_ref is null then raise exception 'no such thread'; end if;

  perform admin_log('Updated ticket', 'other', 'support_thread', tid::text, v_ref, payload);
end;
$$;
revoke execute on function admin_set_thread(uuid, jsonb) from anon, public;
grant execute on function admin_set_thread(uuid, jsonb) to authenticated;

-- Start a thread against a teacher — "message this teacher" from their drawer.
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

  v_ref := 'TK-' || lpad((
    select coalesce(count(*), 0) + 1001 from support_threads
  )::text, 4, '0');

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

create or replace function admin_support_summary()
returns table (
  open_count       bigint,
  pending_count    bigint,
  high_priority    bigint,
  unassigned       bigint,
  unread           bigint,
  closed_this_week bigint
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    select
      count(*) filter (where t.status = 'open'),
      count(*) filter (where t.status = 'pending'),
      count(*) filter (where t.status <> 'closed' and t.priority = 'high'),
      count(*) filter (where t.status <> 'closed' and t.assigned_to is null),
      count(*) filter (where t.status <> 'closed' and t.unread),
      count(*) filter (where t.status = 'closed' and t.closed_at >= now() - interval '7 days')
    from support_threads t;
end;
$$;
revoke execute on function admin_support_summary() from anon, public;
grant execute on function admin_support_summary() to authenticated;

create or replace function admin_canned_replies()
returns table (key text, label text, body text, sort integer)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    select c.key, c.label, c.body, c.sort from canned_replies c order by c.sort;
end;
$$;
revoke execute on function admin_canned_replies() from anon, public;
grant execute on function admin_canned_replies() to authenticated;

-- Support history for one teacher — powers the drawer section that currently
-- says "Coming soon".
create or replace function admin_teacher_threads(uid uuid)
returns table (
  id uuid, reference text, subject text, status text,
  priority text, message_count bigint, updated_at timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    select t.id, t.reference, t.subject, t.status, t.priority,
           (select count(*) from support_messages m where m.thread_id = t.id),
           t.updated_at
    from support_threads t
    where t.user_id = uid
    order by t.updated_at desc;
end;
$$;
revoke execute on function admin_teacher_threads(uuid) from anon, public;
grant execute on function admin_teacher_threads(uuid) to authenticated;
