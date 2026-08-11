-- ── Teacher admin actions ────────────────────────────────────────────────────
-- Backs the Teachers tab's drawer buttons, which until now were stubs that
-- popped "…isn't wired up yet" instead of doing anything: suspend, internal
-- notes, the full activity log, and audit entries for the actions that have to
-- be performed with the service role from a route handler rather than in SQL.

-- ── Suspension state ─────────────────────────────────────────────────────────
-- Suspension is ENFORCED by auth.users.banned_until, set from a route handler
-- via auth.admin.updateUserById(). That is the only thing that actually stops a
-- login, so it has to be the mechanism.
--
-- These columns are the READ surface. admin_users() needs something cheap to
-- render a "Suspended" chip and filter on, and reaching into auth.users from
-- every admin listing RPC purely to read a ban flag isn't worth it. The
-- /api/admin/teachers/suspend route writes both and rolls this back if the auth
-- ban fails, so the flag can never claim "suspended" while the account still
-- logs in.
alter table profiles add column if not exists suspended_at     timestamptz;
alter table profiles add column if not exists suspended_reason text;
alter table profiles add column if not exists suspended_by     uuid references auth.users(id) on delete set null;

create index if not exists profiles_suspended_idx
  on profiles (suspended_at) where suspended_at is not null;

-- ── Internal notes ───────────────────────────────────────────────────────────
-- Append-only, like admin_audit_log: a note records what staff believed at a
-- point in time, so editing one rewrites history. There is deliberately no
-- UPDATE policy. Deletion is allowed to the author alone, for the "wrote it on
-- the wrong teacher" case.
create table if not exists teacher_notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  body       text not null check (length(trim(body)) > 0 and length(body) <= 4000),
  author_id  uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists teacher_notes_user_idx on teacher_notes (user_id, created_at desc);

alter table teacher_notes enable row level security;

-- Admins only. The drawer's placeholder text promises "Only your team sees
-- this" — that has to be true in the schema, not just in the copy.
drop policy if exists "admins read teacher notes" on teacher_notes;
create policy "admins read teacher notes" on teacher_notes
  for select using (is_admin());

drop policy if exists "authors delete teacher notes" on teacher_notes;
create policy "authors delete teacher notes" on teacher_notes
  for delete using (is_admin() and author_id = auth.uid());

-- No INSERT or UPDATE policy: writes go through admin_add_teacher_note() only,
-- so every note is audit-logged. Same reasoning as admin_audit_log itself.

-- ── Add a note ───────────────────────────────────────────────────────────────
create or replace function admin_add_teacher_note(uid uuid, p_body text)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id    uuid;
  v_label text;
begin
  if not is_admin() then raise exception 'not authorized'; end if;

  if p_body is null or trim(p_body) = '' then
    raise exception 'note cannot be empty';
  end if;
  if length(p_body) > 4000 then
    raise exception 'note is too long (max 4000 characters)';
  end if;
  if not exists (select 1 from auth.users where id = uid) then
    raise exception 'no such teacher';
  end if;

  insert into teacher_notes (user_id, body, author_id)
  values (uid, trim(p_body), auth.uid())
  returning id into v_id;

  select coalesce(nullif(trim(coalesce(p.first_name,'') || ' ' || coalesce(p.surname,'')), ''), u.email::text)
    into v_label
  from auth.users u
  left join profiles p on p.id = u.id
  where u.id = uid;

  -- The note body is deliberately NOT copied into the audit detail. The audit
  -- log is the surface shown to a school's data protection officer; an internal
  -- staff note about a teacher does not belong in it. Length only.
  perform admin_log(
    'Added an internal note',
    'account',
    'user',
    uid::text,
    v_label,
    jsonb_build_object('note_id', v_id, 'length', length(trim(p_body)))
  );

  return v_id;
end;
$$;
revoke execute on function admin_add_teacher_note(uuid, text) from anon, public;
grant execute on function admin_add_teacher_note(uuid, text) to authenticated;

-- ── Read notes for one teacher ───────────────────────────────────────────────
create or replace function admin_teacher_notes(uid uuid, lim integer default 20)
returns table (
  id           uuid,
  body         text,
  author_email text,
  created_at   timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    select n.id, n.body, u.email::text, n.created_at
    from teacher_notes n
    left join auth.users u on u.id = n.author_id
    where n.user_id = uid
    order by n.created_at desc
    limit lim;
end;
$$;
revoke execute on function admin_teacher_notes(uuid, integer) from anon, public;
grant execute on function admin_teacher_notes(uuid, integer) to authenticated;

-- ── Full activity log for one teacher ────────────────────────────────────────
-- Deliberately separate from admin_teacher_recent_runs rather than bumping its
-- `lim`: that one also feeds the support inbox's context rail and needs to stay
-- cheap. This one is paginated and returns a total so the modal can page.
--
-- TODO: approx_cost_usd uses the same ±1 minute window join as
-- 20260804165118_admin_teacher_activity_cost.sql. Correlated subqueries over a
-- teacher's whole history are fine at current volume (hundreds of runs) but
-- will need a materialised cost-per-run column if a single teacher ever
-- accumulates tens of thousands.
create or replace function admin_teacher_activity(
  uid uuid,
  lim integer default 50,
  off integer default 0
)
returns table (
  id              uuid,
  tool_slug       text,
  title           text,
  created_at      timestamptz,
  approx_cost_usd numeric,
  total_count     bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    with runs as (
      select r.id, r.tool_slug, r.title, r.created_at
      from tool_runs r
      where r.user_id = uid
    ),
    total as (select count(*) as n from runs),
    page as (
      select * from runs order by runs.created_at desc limit lim offset off
    )
    select
      rp.id,
      rp.tool_slug,
      rp.title,
      rp.created_at,
      coalesce((
        select sum(t.cost_usd) from token_usage t
        where t.user_id = uid
          and t.created_at between rp.created_at - interval '1 minute'
                               and rp.created_at + interval '1 minute'
      ), 0)
      + coalesce((
        select sum(a.cost_usd) from asset_cost a
        where a.user_id = uid
          and a.created_at between rp.created_at - interval '1 minute'
                               and rp.created_at + interval '1 minute'
      ), 0),
      (select total.n from total)
    from page rp
    order by rp.created_at desc;
end;
$$;
revoke execute on function admin_teacher_activity(uuid, integer, integer) from anon, public;
grant execute on function admin_teacher_activity(uuid, integer, integer) to authenticated;

-- ── Audit wrappers for service-role actions ──────────────────────────────────
-- admin_log() is intentionally not granted to `authenticated` so an admin can't
-- forge arbitrary audit entries. But suspension, plan changes, refunds and
-- password resets all have to happen in a route handler (they call the Supabase
-- admin API or Stripe, neither reachable from SQL), and those still have to be
-- audited. These thin wrappers are the sanctioned path: each one hard-codes its
-- own action verb and type, so the caller chooses the object, never the story.

create or replace function admin_teacher_label(uid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(trim(coalesce(p.first_name,'') || ' ' || coalesce(p.surname,'')), ''), u.email::text)
  from auth.users u
  left join profiles p on p.id = u.id
  where u.id = uid;
$$;
-- Internal helper for the log wrappers only. `authenticated` is revoked
-- explicitly as well as `public`: revoking from public alone leaves the grant
-- that `authenticated` inherits, so the function stays callable without it.
revoke execute on function admin_teacher_label(uuid) from public, anon, authenticated;

create or replace function admin_log_suspension(uid uuid, p_suspend boolean, p_reason text default null)
returns void
language plpgsql volatile security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  perform admin_log(
    case when p_suspend then 'Suspended an account' else 'Lifted a suspension' end,
    'account', 'user', uid::text, admin_teacher_label(uid),
    jsonb_build_object('suspended', p_suspend, 'reason', p_reason)
  );
end;
$$;
revoke execute on function admin_log_suspension(uuid, boolean, text) from anon, public;
grant execute on function admin_log_suspension(uuid, boolean, text) to authenticated;

create or replace function admin_log_plan_change(
  uid uuid, p_from text, p_to text, p_reason text, p_method text
)
returns void
language plpgsql volatile security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  perform admin_log(
    'Changed plan from ' || coalesce(p_from, 'free') || ' to ' || p_to,
    'billing', 'user', uid::text, admin_teacher_label(uid),
    jsonb_build_object('from', p_from, 'to', p_to, 'reason', p_reason, 'method', p_method)
  );
end;
$$;
revoke execute on function admin_log_plan_change(uuid, text, text, text, text) from anon, public;
grant execute on function admin_log_plan_change(uuid, text, text, text, text) to authenticated;

create or replace function admin_log_password_reset(uid uuid, p_sent boolean)
returns void
language plpgsql volatile security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  perform admin_log(
    'Sent a password reset link',
    'access', 'user', uid::text, admin_teacher_label(uid),
    jsonb_build_object('delivered', p_sent)
  );
end;
$$;
revoke execute on function admin_log_password_reset(uuid, boolean) from anon, public;
grant execute on function admin_log_password_reset(uuid, boolean) to authenticated;

create or replace function admin_log_refund(
  uid uuid, p_charge_id text, p_amount_pence integer, p_reason text
)
returns void
language plpgsql volatile security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  perform admin_log(
    'Issued a refund of ' || to_char(p_amount_pence / 100.0, 'FM999999.00'),
    'billing', 'user', uid::text, admin_teacher_label(uid),
    jsonb_build_object('charge_id', p_charge_id, 'amount_pence', p_amount_pence, 'reason', p_reason)
  );
end;
$$;
revoke execute on function admin_log_refund(uuid, text, integer, text) from anon, public;
grant execute on function admin_log_refund(uuid, text, integer, text) to authenticated;

create or replace function admin_log_portal_link(uid uuid)
returns void
language plpgsql volatile security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  perform admin_log(
    'Created a billing portal link',
    'billing', 'user', uid::text, admin_teacher_label(uid),
    '{}'::jsonb
  );
end;
$$;
revoke execute on function admin_log_portal_link(uuid) from anon, public;
grant execute on function admin_log_portal_link(uuid) to authenticated;

create or replace function admin_log_invites(
  p_sent integer, p_requested integer, p_plan text
)
returns void
language plpgsql volatile security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  perform admin_log(
    'Invited ' || p_sent || ' teacher' || case when p_sent = 1 then '' else 's' end,
    'access', 'user', null, null,
    jsonb_build_object('sent', p_sent, 'requested', p_requested, 'plan', p_plan)
  );
end;
$$;
revoke execute on function admin_log_invites(integer, integer, text) from anon, public;
grant execute on function admin_log_invites(integer, integer, text) to authenticated;

-- ── Email templates for the new flows ────────────────────────────────────────
-- 'password_reset' already exists (seeded with the original admin console).
insert into email_templates (key, name, trigger_description, subject, body, live, sort)
values
  (
    'teacher_invite',
    'Teacher invite',
    'An admin invites a teacher from the Teachers tab',
    'You have been invited to Jooma',
    'Sent with a one-time link that lets the teacher set their own password.',
    true,
    13
  ),
  (
    'account_suspended',
    'Account suspended',
    'An admin suspends a teacher''s account',
    'Your Jooma account has been suspended',
    'Only sent when the admin ticks "email them" while suspending.',
    true,
    14
  )
on conflict (key) do nothing;
