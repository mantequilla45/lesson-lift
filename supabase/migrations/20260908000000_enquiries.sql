-- ── Contact and school enquiries ─────────────────────────────────────────────
--
-- Every "get in touch" affordance on the marketing site used to be a mailto:
-- pointing at a mailbox that mostly did not exist (support@, schools@, sales@).
-- A mailto hands the message to the visitor's own mail client and collects none
-- of the fields needed to qualify a school lead. These two tables are where
-- those forms land instead, worked from /admin/enquiries.
--
-- THE SHAPE THAT MATTERS: submit_enquiry is the first unauthenticated write in
-- this codebase. There is deliberately NO anon insert policy on `enquiries` —
-- the two tables that once had one were both hardened later
-- (20260805000300_generated_images_rls_hardening.sql), and a policy grants the
-- whole table where a security definer function grants exactly one operation.
-- Public submission therefore goes through submit_enquiry() and nothing else.
--
-- enquiry_replies mirrors support_messages: admin-only in BOTH directions,
-- because it holds internal notes alongside sent replies. There is no
-- teacher-facing read path and there must never be one.

-- ── Tables ───────────────────────────────────────────────────────────────────

create table if not exists enquiries (
  id          uuid primary key default gen_random_uuid(),
  reference   text unique not null,
  kind        text not null check (kind in ('contact', 'school')),
  -- Null for a public submission. `on delete set null` rather than cascade: a
  -- teacher closing their account must not silently delete a school's lead.
  user_id     uuid references auth.users (id) on delete set null,
  name        text not null check (length(btrim(name)) between 1 and 120),
  email       text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone       text check (phone is null or length(btrim(phone)) <= 40),
  school      text check (school is null or length(btrim(school)) <= 160),
  licences    integer check (licences is null or licences between 1 and 100000),
  heard_about text check (heard_about is null or length(heard_about) <= 40),
  heard_other text check (heard_other is null or length(btrim(heard_other)) <= 120),
  message     text check (message is null or length(message) <= 5000),
  status      text not null default 'new'
              check (status in ('new', 'in_progress', 'closed')),
  assigned_to uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- A school enquiry with no school name and no phone number cannot be acted
  -- on, so it is rejected at the column rather than left for someone to notice.
  constraint enquiries_school_fields check (
    kind <> 'school'
    or (school is not null and btrim(school) <> ''
        and phone is not null and btrim(phone) <> '')
  )
);

alter table enquiries enable row level security;

-- The admin list sorts by status then recency, and filters by kind.
create index if not exists enquiries_triage_idx on enquiries (status, created_at desc);
create index if not exists enquiries_kind_idx on enquiries (kind, created_at desc);
-- Used by the per-address throttle in submit_enquiry().
create index if not exists enquiries_email_idx on enquiries (lower(email), created_at desc);

create table if not exists enquiry_replies (
  id         uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references enquiries (id) on delete cascade,
  author_id  uuid not null references auth.users (id),
  body       text not null check (length(btrim(body)) between 1 and 5000),
  -- An internal note is written on the assumption the enquirer cannot see it.
  -- Mailing one is the single mistake in this feature that reaches a customer;
  -- the gate lives in /api/enquiries/reply, in an `if (!isNote)` block.
  is_note    boolean not null default false,
  -- Whether SendGrid actually accepted it. Recorded so the console can show
  -- "saved but not sent" honestly rather than implying every reply went out.
  emailed    boolean not null default false,
  created_at timestamptz not null default now()
);

alter table enquiry_replies enable row level security;

create index if not exists enquiry_replies_thread_idx
  on enquiry_replies (enquiry_id, created_at);

/**
 * Per-IP submission log, for the throttle in /api/enquiries.
 *
 * The handover asks for public endpoints to be "rate limited hard by IP" and
 * nothing in the codebase did it, because until now nothing was reachable
 * without a session. Written and read by the service role only.
 *
 * Deliberately not a foreign key to anything and holding no message content:
 * it exists to be counted and pruned, so it stores the least that makes it work.
 */
create table if not exists enquiry_rate (
  id         uuid primary key default gen_random_uuid(),
  ip         text not null,
  created_at timestamptz not null default now()
);

alter table enquiry_rate enable row level security;

-- The lookup is always "this IP, in the last hour", and the prune is always
-- "older than a day".
create index if not exists enquiry_rate_ip_idx on enquiry_rate (ip, created_at desc);
create index if not exists enquiry_rate_age_idx on enquiry_rate (created_at);

-- No policies and no grants at all: RLS on with nothing granted means only the
-- service role reaches it, which is exactly the intent. anon and authenticated
-- can neither read who has submitted nor clear their own count.

-- ── RLS: admin only, both tables, both directions ────────────────────────────
--
-- is_admin() is declared stable and takes no per-row input, so Postgres hoists
-- it out of the scan on its own. The `(select auth.uid())` wrapper that
-- 20260805002000 introduced is not needed here because no policy below
-- references auth.uid() at all.

drop policy if exists "admin reads enquiries" on enquiries;
create policy "admin reads enquiries" on enquiries
  for select using (is_admin());

drop policy if exists "admin writes enquiries" on enquiries;
create policy "admin writes enquiries" on enquiries
  for update using (is_admin()) with check (is_admin());

drop policy if exists "admin reads enquiry replies" on enquiry_replies;
create policy "admin reads enquiry replies" on enquiry_replies
  for select using (is_admin());

drop policy if exists "admin writes enquiry replies" on enquiry_replies;
create policy "admin writes enquiry replies" on enquiry_replies
  for insert with check (is_admin());

-- No grant to anon on either table. Public submission goes through
-- submit_enquiry(), and every admin write goes through a security definer RPC,
-- so neither needs a table grant. SELECT only, gated by the policies above.
-- (20260908000100 revokes the wider grants this originally carried.)
grant select on enquiries to authenticated;
grant select on enquiry_replies to authenticated;

-- ── Reference numbers ────────────────────────────────────────────────────────
-- "EN-1001", mirroring the support inbox's TK- series. A sequence rather than
-- count(*)+1001 so two submissions in the same second cannot collide.

create sequence if not exists enquiry_reference_seq start with 1001;

create or replace function next_enquiry_reference()
returns text language sql volatile set search_path = public
as $$
  select 'EN-' || lpad(nextval('enquiry_reference_seq')::text, 4, '0');
$$;
-- Postgres grants EXECUTE to PUBLIC by default, which is how anon reached the
-- admin RPCs before 20260805000200. submit_enquiry() is security definer and so
-- does not need the grant; nothing else calls this.
revoke execute on function next_enquiry_reference() from public;
grant execute on function next_enquiry_reference() to authenticated;

-- ── Public submission ────────────────────────────────────────────────────────

/**
 * The only non-admin write path into `enquiries`.
 *
 * Granted to anon because a school enquiring about licences has no account yet
 * and should not need one. It returns ONLY the new reference and never reads an
 * existing row back, so it cannot be turned into an oracle the way a definer
 * function that answers questions about stored data can be — the trap
 * 20260813000900_fix_invite_exception_rls.sql documents for has_open_invite.
 *
 * Errors are raised with wording a teacher can read, because the client
 * surfaces them verbatim, exactly as my_create_thread does.
 */
create or replace function submit_enquiry(payload jsonb)
returns text
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_kind        text := nullif(btrim(payload->>'kind'), '');
  v_name        text := nullif(btrim(payload->>'name'), '');
  v_email       text := lower(nullif(btrim(payload->>'email'), ''));
  v_phone       text := nullif(btrim(payload->>'phone'), '');
  v_school      text := nullif(btrim(payload->>'school'), '');
  v_heard       text := nullif(btrim(payload->>'heard_about'), '');
  v_heard_other text := nullif(btrim(payload->>'heard_other'), '');
  v_message     text := nullif(btrim(payload->>'message'), '');
  v_licences    integer;
  v_ref         text;
  v_recent      integer;
begin
  if v_kind is null or v_kind not in ('contact', 'school') then
    raise exception 'Choose what your message is about.';
  end if;
  if v_name is null then
    raise exception 'Your name is required.';
  end if;
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'That does not look like an email address.';
  end if;

  if v_kind = 'school' then
    if v_school is null then raise exception 'Your school name is required.'; end if;
    if v_phone  is null then raise exception 'A phone number is required.';   end if;
  end if;

  -- Sent as a string by the form; a non-numeric value is treated as "not said"
  -- rather than failing the whole submission over an optional field.
  begin
    v_licences := nullif(btrim(payload->>'licences'), '')::integer;
  exception when others then
    v_licences := null;
  end;
  if v_licences is not null and (v_licences < 1 or v_licences > 100000) then
    v_licences := null;
  end if;

  -- Per-address throttle. The route also throttles by IP, but that protects the
  -- endpoint rather than the table: this is the brake that survives someone
  -- moving between networks, and it is enforced wherever the function is called
  -- from. Worded as reassurance because the common trigger is an anxious person
  -- pressing submit twice, not an attacker.
  select count(*) into v_recent
  from enquiries
  where lower(email) = v_email
    and created_at > now() - interval '1 hour';

  if v_recent >= 3 then
    raise exception 'Thanks, we already have your message. We will be in touch.';
  end if;

  v_ref := next_enquiry_reference();

  insert into enquiries (
    reference, kind, user_id, name, email, phone, school,
    licences, heard_about, heard_other, message
  )
  values (
    v_ref, v_kind, auth.uid(), v_name, v_email, v_phone, v_school,
    v_licences, v_heard,
    -- Only meaningful alongside "other"; kept off the row otherwise so the
    -- admin pane never shows a stale free-text answer next to a picked one.
    case when v_heard = 'other' then v_heard_other else null end,
    v_message
  );

  return v_ref;
end;
$$;
revoke execute on function submit_enquiry(jsonb) from public;
grant execute on function submit_enquiry(jsonb) to anon, authenticated;

-- ── Admin RPCs ───────────────────────────────────────────────────────────────

/**
 * List for the left pane. Carries enough of each row to triage without opening
 * anything, and the reply count so a lead nobody has answered is visible.
 */
create or replace function admin_enquiries(
  p_kind   text default null,   -- 'contact' | 'school' | null
  p_status text default null,   -- 'new' | 'in_progress' | 'closed' | null
  q        text default null
)
returns table (
  id          uuid,
  reference   text,
  kind        text,
  name        text,
  email       text,
  phone       text,
  school      text,
  licences    integer,
  heard_about text,
  heard_other text,
  message     text,
  status      text,
  assigned_to uuid,
  assignee    text,
  user_id     uuid,
  reply_count bigint,
  last_reply_at timestamptz,
  created_at  timestamptz,
  updated_at  timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    select
      e.id, e.reference, e.kind, e.name, e.email, e.phone, e.school,
      e.licences, e.heard_about, e.heard_other, e.message, e.status,
      e.assigned_to, au.email::text, e.user_id,
      (select count(*) from enquiry_replies r
        where r.enquiry_id = e.id and not r.is_note),
      (select max(r.created_at) from enquiry_replies r
        where r.enquiry_id = e.id and not r.is_note),
      e.created_at, e.updated_at
    from enquiries e
    left join auth.users au on au.id = e.assigned_to
    where (p_kind is null or p_kind = '' or e.kind = p_kind)
      and (p_status is null or p_status = '' or e.status = p_status)
      and (q is null or q = ''
           or e.name      ilike '%' || q || '%'
           or e.email     ilike '%' || q || '%'
           or e.reference ilike '%' || q || '%'
           or coalesce(e.school, '') ilike '%' || q || '%')
    order by
      -- Unanswered first. The list should surface what needs doing, not what
      -- changed most recently, matching admin_threads.
      case e.status when 'new' then 0 when 'in_progress' then 1 else 2 end,
      e.created_at desc;
end;
$$;
revoke execute on function admin_enquiries(text, text, text) from anon, public;
grant execute on function admin_enquiries(text, text, text) to authenticated;

create or replace function admin_enquiry_replies(eid uuid)
returns table (
  id         uuid,
  body       text,
  is_note    boolean,
  emailed    boolean,
  author     text,
  created_at timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    select r.id, r.body, r.is_note, r.emailed, u.email::text, r.created_at
    from enquiry_replies r
    left join auth.users u on u.id = r.author_id
    where r.enquiry_id = eid
    order by r.created_at;
end;
$$;
revoke execute on function admin_enquiry_replies(uuid) from anon, public;
grant execute on function admin_enquiry_replies(uuid) to authenticated;

/**
 * Record a reply or an internal note. The email is sent by
 * /api/enquiries/reply, not here: a database function has no business talking
 * to SendGrid, and the route flips `emailed` afterwards to whatever actually
 * happened.
 */
create or replace function admin_enquiry_reply(
  eid uuid, p_body text, is_note boolean default false
)
returns uuid
language plpgsql volatile security definer set search_path = public
as $$
declare v_id uuid; v_ref text;
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  if coalesce(btrim(p_body), '') = '' then raise exception 'a message body is required'; end if;

  select reference into v_ref from enquiries where id = eid;
  if v_ref is null then raise exception 'no such enquiry'; end if;

  insert into enquiry_replies (enquiry_id, author_id, body, is_note)
  values (eid, auth.uid(), p_body, is_note)
  returning id into v_id;

  -- A real reply moves the enquiry along; a private note does not, because the
  -- enquirer is still waiting on an actual answer.
  if not is_note then
    update enquiries
    set status = case when status = 'new' then 'in_progress' else status end,
        updated_at = now()
    where id = eid;
  end if;

  perform admin_log(
    case when is_note then 'Added note to enquiry' else 'Replied to enquiry' end,
    'other', 'enquiry', eid::text, v_ref,
    jsonb_build_object('is_note', is_note)
  );

  return v_id;
end;
$$;
revoke execute on function admin_enquiry_reply(uuid, text, boolean) from anon, public;
grant execute on function admin_enquiry_reply(uuid, text, boolean) to authenticated;

/** Flip `emailed` once delivery is known. Separate from the insert because the
 *  send happens in the route, after the row is already durable. */
create or replace function admin_enquiry_mark_emailed(rid uuid)
returns void
language plpgsql volatile security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  update enquiry_replies set emailed = true where id = rid;
end;
$$;
revoke execute on function admin_enquiry_mark_emailed(uuid) from anon, public;
grant execute on function admin_enquiry_mark_emailed(uuid) to authenticated;

/** Status and assignment, as a jsonb patch — the admin_set_thread pattern. */
create or replace function admin_set_enquiry(eid uuid, payload jsonb)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare v_ref text; v_status text;
begin
  if not is_admin() then raise exception 'not authorized'; end if;

  v_status := nullif(payload->>'status', '');
  if v_status is not null and v_status not in ('new', 'in_progress', 'closed') then
    raise exception 'invalid status';
  end if;

  update enquiries set
    status      = coalesce(v_status, status),
    assigned_to = case
                    when payload ? 'assign_to_me' and (payload->>'assign_to_me')::boolean
                      then auth.uid()
                    when payload ? 'unassign' and (payload->>'unassign')::boolean
                      then null
                    else assigned_to
                  end,
    updated_at  = now()
  where id = eid
  returning reference into v_ref;

  if v_ref is null then raise exception 'no such enquiry'; end if;

  perform admin_log('Updated enquiry', 'other', 'enquiry', eid::text, v_ref, payload);
end;
$$;
revoke execute on function admin_set_enquiry(uuid, jsonb) from anon, public;
grant execute on function admin_set_enquiry(uuid, jsonb) to authenticated;

/** Powers the sidebar badge. `new_count` only: an enquiry someone has already
 *  picked up is not a thing the badge should keep nagging about. */
create or replace function admin_enquiry_summary()
returns table (
  new_count         bigint,
  in_progress_count bigint,
  school_new        bigint,
  contact_new       bigint
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    select
      count(*) filter (where e.status = 'new'),
      count(*) filter (where e.status = 'in_progress'),
      count(*) filter (where e.status = 'new' and e.kind = 'school'),
      count(*) filter (where e.status = 'new' and e.kind = 'contact')
    from enquiries e;
end;
$$;
revoke execute on function admin_enquiry_summary() from anon, public;
grant execute on function admin_enquiry_summary() to authenticated;

-- ── Email template row ───────────────────────────────────────────────────────
-- Subject line and the live/paused switch live in the table so the wording can
-- change without a deploy; the HTML body is in code
-- (app/lib/email-templates/enquiryReply.ts). Guarded insert so re-running is
-- safe, matching the seed style used elsewhere.
insert into email_templates (key, name, trigger_description, subject, live)
select 'enquiry_reply', 'Enquiry reply',
       'Sent when an admin replies to a contact or school enquiry from /admin/enquiries. Internal notes never trigger this. Sent from info@jooma.ai so a reply reaches a real mailbox.',
       'Re: your enquiry about Jooma', true
where not exists (select 1 from email_templates where key = 'enquiry_reply');
