-- ── Admin audit log ──────────────────────────────────────────────────────────
-- Every admin action, permanently. This is what gets shown to a school's data
-- protection officer when they ask what Jooma staff can see and do.
--
-- The table is INSERT-ONLY by design: admins may read it, the helper may write
-- to it, and there is deliberately NO update or delete policy for anyone —
-- including super admins. That promise is enforced here in the schema rather
-- than merely stated in the UI copy.

create table if not exists admin_audit_log (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid references auth.users(id) on delete set null,
  actor_email  text,
  -- Free-text verb, e.g. 'Granted resources', 'Changed plan'. Kept as text
  -- rather than an enum so a new admin action never needs a migration.
  action       text not null,
  -- Coarse bucket used by the audit page's filter dropdown.
  action_type  text not null default 'other'
                 check (action_type in ('account','billing','content','access','other')),
  object_type  text,
  object_id    text,
  object_label text,
  detail       jsonb not null default '{}'::jsonb,
  ip           text,
  created_at   timestamptz not null default now()
);

create index if not exists admin_audit_log_created_idx on admin_audit_log (created_at desc);
create index if not exists admin_audit_log_actor_idx   on admin_audit_log (actor_id, created_at desc);
create index if not exists admin_audit_log_object_idx  on admin_audit_log (object_type, object_id);

alter table admin_audit_log enable row level security;

-- Read: admins only. No insert policy — writes go exclusively through
-- admin_log(), which is security definer and therefore bypasses RLS. That
-- keeps the write path auditable in one place.
drop policy if exists "admins read audit log" on admin_audit_log;
create policy "admins read audit log" on admin_audit_log
  for select using (is_admin());

-- ── Write helper ─────────────────────────────────────────────────────────────
-- Called by every mutating admin_* RPC. Records who did what to which object.
-- Note this is intentionally NOT granted to authenticated: it is only ever
-- invoked from inside another security-definer function, so an admin can't
-- forge an arbitrary audit entry by calling it directly.
create or replace function admin_log(
  p_action       text,
  p_action_type  text default 'other',
  p_object_type  text default null,
  p_object_id    text default null,
  p_object_label text default null,
  p_detail       jsonb default '{}'::jsonb
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  select u.email::text into v_email from auth.users u where u.id = auth.uid();

  insert into admin_audit_log (
    actor_id, actor_email, action, action_type,
    object_type, object_id, object_label, detail
  )
  values (
    auth.uid(), v_email, p_action, coalesce(p_action_type, 'other'),
    p_object_type, p_object_id, p_object_label, coalesce(p_detail, '{}'::jsonb)
  );
end;
$$;

revoke execute on function admin_log(text, text, text, text, text, jsonb) from public, anon, authenticated;

-- ── Read RPC ─────────────────────────────────────────────────────────────────
create or replace function admin_audit_log_list(
  q           text default null,
  actor       text default null,
  p_type      text default null,
  lim         integer default 100,
  off         integer default 0
)
returns table (
  id           uuid,
  actor_email  text,
  action       text,
  action_type  text,
  object_type  text,
  object_id    text,
  object_label text,
  detail       jsonb,
  ip           text,
  created_at   timestamptz,
  total_count  bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    with filtered as (
      select a.*
      from admin_audit_log a
      where (q is null or q = '' or
             a.action ilike '%' || q || '%' or
             coalesce(a.object_label, '') ilike '%' || q || '%' or
             coalesce(a.object_id, '') ilike '%' || q || '%')
        and (actor is null or actor = '' or a.actor_email = actor)
        and (p_type is null or p_type = '' or a.action_type = p_type)
    )
    select f.id, f.actor_email, f.action, f.action_type,
           f.object_type, f.object_id, f.object_label, f.detail, f.ip, f.created_at,
           (select count(*) from filtered)
    from filtered f
    order by f.created_at desc
    limit lim offset off;
end;
$$;
grant execute on function admin_audit_log_list(text, text, text, integer, integer) to authenticated;

-- Distinct actors, for the audit page's "Everyone" dropdown.
create or replace function admin_audit_actors()
returns table (actor_email text, entries bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    select a.actor_email, count(*)
    from admin_audit_log a
    where a.actor_email is not null
    group by a.actor_email
    order by 2 desc;
end;
$$;
grant execute on function admin_audit_actors() to authenticated;
