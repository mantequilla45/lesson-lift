-- ── Allowances & grants ──────────────────────────────────────────────────────
-- Two separate pools, deliberately never merged:
--
--   resources  — any text generation. ~0.9p each.
--   ai_image   — AI-image slideshows. ~28p each, 33x a resource.
--
-- Usage is DERIVED, not stored: resources used = count(tool_runs) this month,
-- AI images used = count(asset_cost where kind='image') this month. Only the
-- *grants* are stored, because a grant is an admin decision that needs an
-- audit trail; usage is already recorded elsewhere and duplicating it would
-- create two sources of truth that can drift.
--
-- Grants top up the current month and do not roll over.

create table if not exists allowance_grants (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('resource', 'ai_image')),
  amount      integer not null check (amount > 0),
  reason      text not null default 'Goodwill — support issue',
  granted_by  uuid references auth.users(id) on delete set null,
  -- Defaults to the end of the granting month; a null value never expires.
  expires_at  timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists allowance_grants_user_idx
  on allowance_grants (user_id, kind, created_at desc);

alter table allowance_grants enable row level security;

-- A teacher may see their own grants (so the app can explain why their
-- allowance went up). Only admins can create them, and that happens through
-- admin_grant_allowance() below, which is security definer.
drop policy if exists "own grants read" on allowance_grants;
create policy "own grants read" on allowance_grants
  for select using (auth.uid() = user_id or is_admin());

-- ── Current-month allowance ──────────────────────────────────────────────────
-- One row describing where a teacher stands right now. Used by the teachers
-- table, the teacher drawer, the support inbox context rail and the top-up
-- flow — they must all agree, so they all read this.
create or replace function monthly_allowance(uid uuid)
returns table (
  resources_used    bigint,
  resources_topup   bigint,
  ai_used           bigint,
  ai_topup          bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- A teacher may read their own; an admin may read anyone's.
  if uid <> auth.uid() and not is_admin() then
    raise exception 'not authorized';
  end if;

  return query
    select
      (select count(*) from tool_runs r
        where r.user_id = uid
          and r.created_at >= date_trunc('month', now())),
      (select coalesce(sum(g.amount), 0)::bigint from allowance_grants g
        where g.user_id = uid
          and g.kind = 'resource'
          and g.created_at >= date_trunc('month', now())
          and (g.expires_at is null or g.expires_at > now())),
      (select coalesce(sum(a.units), 0)::bigint from asset_cost a
        where a.user_id = uid
          and a.kind = 'image'
          and a.created_at >= date_trunc('month', now())),
      (select coalesce(sum(g.amount), 0)::bigint from allowance_grants g
        where g.user_id = uid
          and g.kind = 'ai_image'
          and g.created_at >= date_trunc('month', now())
          and (g.expires_at is null or g.expires_at > now()));
end;
$$;
grant execute on function monthly_allowance(uuid) to authenticated;

-- ── Grant ────────────────────────────────────────────────────────────────────
create or replace function admin_grant_allowance(
  uid     uuid,
  p_kind  text,
  p_amount integer,
  p_reason text default 'Goodwill — support issue'
)
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

  if p_kind not in ('resource', 'ai_image') then
    raise exception 'kind must be resource or ai_image';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;
  -- Guard rail: an AI-image grant is ~28p a unit, so a fat-fingered 1000 is
  -- £280 of cost. Cap both kinds at something a human would plausibly intend.
  if p_kind = 'ai_image' and p_amount > 500 then
    raise exception 'AI-image grants are capped at 500';
  end if;
  if p_kind = 'resource' and p_amount > 10000 then
    raise exception 'resource grants are capped at 10000';
  end if;

  insert into allowance_grants (user_id, kind, amount, reason, granted_by, expires_at)
  values (
    uid, p_kind, p_amount, p_reason, auth.uid(),
    -- Expires at the end of the current month; grants never roll over.
    (date_trunc('month', now()) + interval '1 month')
  )
  returning id into v_id;

  select coalesce(nullif(trim(coalesce(p.first_name,'') || ' ' || coalesce(p.surname,'')), ''), u.email::text)
    into v_label
  from auth.users u
  left join profiles p on p.id = u.id
  where u.id = uid;

  perform admin_log(
    case when p_kind = 'ai_image'
      then 'Granted ' || p_amount || ' AI-image slideshows'
      else 'Granted ' || p_amount || ' resources' end,
    'account',
    'user',
    uid::text,
    v_label,
    jsonb_build_object('kind', p_kind, 'amount', p_amount, 'reason', p_reason)
  );

  return v_id;
end;
$$;
grant execute on function admin_grant_allowance(uuid, text, integer, text) to authenticated;

-- ── Grant history for one teacher ────────────────────────────────────────────
create or replace function admin_teacher_grants(uid uuid, lim integer default 20)
returns table (
  id         uuid,
  kind       text,
  amount     integer,
  reason     text,
  granted_by_email text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    select g.id, g.kind, g.amount, g.reason, u.email::text, g.created_at
    from allowance_grants g
    left join auth.users u on u.id = g.granted_by
    where g.user_id = uid
    order by g.created_at desc
    limit lim;
end;
$$;
grant execute on function admin_teacher_grants(uuid, integer) to authenticated;
