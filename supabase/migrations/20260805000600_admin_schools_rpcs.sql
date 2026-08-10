-- ── School admin RPCs ────────────────────────────────────────────────────────
-- Reads roll the seat rows up into the counts the seat-pool visualisation
-- needs, and join on the pooled resource/AI usage of every teacher in the
-- school. Writes all record an audit row.

-- ── List ─────────────────────────────────────────────────────────────────────
create or replace function admin_schools()
returns table (
  id                 uuid,
  name               text,
  urn                text,
  town               text,
  trust_name         text,
  status             text,
  seats              integer,
  seats_assigned     bigint,
  seats_invited      bigint,
  seats_dormant      bigint,
  seats_free         bigint,
  rate               numeric,
  monthly_value      numeric,
  annual_value       numeric,
  resources_used     bigint,
  resources_pool     integer,
  ai_used            bigint,
  ai_pool            integer,
  cost_usd           numeric,
  onboarding_percent integer,
  renews_at          date,
  created_at         timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    with seat_rollup as (
      select
        s.school_id,
        count(*) filter (where s.status = 'assigned') as assigned,
        count(*) filter (where s.status = 'invited')  as invited,
        count(*) filter (where s.status = 'dormant')  as dormant,
        count(*) filter (where s.status = 'free')     as free
      from school_seats s
      group by s.school_id
    ),
    usage as (
      select
        p.school_id,
        (select count(*) from tool_runs r
          where r.user_id = p.id and r.created_at >= date_trunc('month', now())) as runs,
        (select coalesce(sum(a.units), 0) from asset_cost a
          where a.user_id = p.id and a.kind = 'image'
            and a.created_at >= date_trunc('month', now())) as images,
        (select coalesce(sum(t.cost_usd), 0) from token_usage t
          where t.user_id = p.id and t.created_at >= date_trunc('month', now()))
        + (select coalesce(sum(a2.cost_usd), 0) from asset_cost a2
          where a2.user_id = p.id and a2.created_at >= date_trunc('month', now())) as cost
      from profiles p
      where p.school_id is not null
    ),
    usage_rollup as (
      select u.school_id,
             sum(u.runs)::bigint   as runs,
             sum(u.images)::bigint as images,
             sum(u.cost)           as cost
      from usage u group by u.school_id
    ),
    tasks as (
      select t.school_id,
             (count(*) filter (where t.done) * 100 / greatest(count(*), 1))::integer as pct
      from school_onboarding_tasks t group by t.school_id
    )
    select
      sc.id, sc.name, sc.urn, sc.town, tr.name,
      sc.status, sc.seats,
      coalesce(sr.assigned, 0), coalesce(sr.invited, 0),
      coalesce(sr.dormant, 0),  coalesce(sr.free, 0),
      seat_rate(sc.seats),
      seat_rate(sc.seats) * sc.seats,
      seat_rate(sc.seats) * sc.seats * 12,
      coalesce(ur.runs, 0),
      sc.seats * sc.resources_per_seat,
      coalesce(ur.images, 0),
      sc.seats * sc.ai_images_per_seat,
      coalesce(ur.cost, 0),
      coalesce(tk.pct, 0),
      sc.renews_at,
      sc.created_at
    from schools sc
    left join trusts tr        on tr.id = sc.trust_id
    left join seat_rollup sr   on sr.school_id = sc.id
    left join usage_rollup ur  on ur.school_id = sc.id
    left join tasks tk         on tk.school_id = sc.id
    order by sc.created_at desc;
end;
$$;
grant execute on function admin_schools() to authenticated;
revoke execute on function admin_schools() from anon, public;
grant execute on function admin_schools() to authenticated;

-- ── Detail ───────────────────────────────────────────────────────────────────
create or replace function admin_school_detail(sid uuid)
returns table (
  id                 uuid,
  name               text,
  urn                text,
  town               text,
  phase              text,
  trust_name         text,
  status             text,
  seats              integer,
  seats_assigned     bigint,
  seats_invited      bigint,
  seats_dormant      bigint,
  seats_free         bigint,
  rate               numeric,
  monthly_value      numeric,
  billing_type       text,
  po_number          text,
  finance_email      text,
  payment_terms      integer,
  invoice_schedule   text,
  vat_registered     boolean,
  contract_start     date,
  renews_at          date,
  contract_months    integer,
  onboarding_fee     numeric,
  dpa_signed_at      timestamptz,
  domain_allowlist   text,
  resources_per_seat integer,
  ai_images_per_seat integer,
  resources_used     bigint,
  ai_used            bigint,
  cost_usd           numeric,
  contact_name       text,
  contact_role       text,
  contact_email      text,
  contact_phone      text,
  notes              text,
  created_at         timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    with seat_rollup as (
      select
        count(*) filter (where s.status = 'assigned') as assigned,
        count(*) filter (where s.status = 'invited')  as invited,
        count(*) filter (where s.status = 'dormant')  as dormant,
        count(*) filter (where s.status = 'free')     as free
      from school_seats s where s.school_id = sid
    ),
    usage_rollup as (
      select
        coalesce(sum((select count(*) from tool_runs r
          where r.user_id = p.id and r.created_at >= date_trunc('month', now()))), 0)::bigint as runs,
        coalesce(sum((select coalesce(sum(a.units), 0) from asset_cost a
          where a.user_id = p.id and a.kind = 'image'
            and a.created_at >= date_trunc('month', now()))), 0)::bigint as images,
        coalesce(sum(
          (select coalesce(sum(t.cost_usd), 0) from token_usage t
            where t.user_id = p.id and t.created_at >= date_trunc('month', now()))
          + (select coalesce(sum(a2.cost_usd), 0) from asset_cost a2
            where a2.user_id = p.id and a2.created_at >= date_trunc('month', now()))
        ), 0) as cost
      from profiles p where p.school_id = sid
    )
    select
      sc.id, sc.name, sc.urn, sc.town, sc.phase, tr.name, sc.status, sc.seats,
      sr.assigned, sr.invited, sr.dormant, sr.free,
      seat_rate(sc.seats), seat_rate(sc.seats) * sc.seats,
      sc.billing_type, sc.po_number, sc.finance_email, sc.payment_terms,
      sc.invoice_schedule, sc.vat_registered,
      sc.contract_start, sc.renews_at, sc.contract_months, sc.onboarding_fee,
      sc.dpa_signed_at, sc.domain_allowlist,
      sc.resources_per_seat, sc.ai_images_per_seat,
      ur.runs, ur.images, ur.cost,
      sc.contact_name, sc.contact_role, sc.contact_email, sc.contact_phone,
      sc.notes, sc.created_at
    from schools sc
    left join trusts tr on tr.id = sc.trust_id
    cross join seat_rollup sr
    cross join usage_rollup ur
    where sc.id = sid;
end;
$$;
revoke execute on function admin_school_detail(uuid) from anon, public;
grant execute on function admin_school_detail(uuid) to authenticated;

-- ── Staff on a school plan ───────────────────────────────────────────────────
create or replace function admin_school_staff(sid uuid)
returns table (
  user_id         uuid,
  email           text,
  first_name      text,
  surname         text,
  seat_status     text,
  invited_email   text,
  last_active     timestamptz,
  resources_used  bigint,
  ai_used         bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    select
      s.user_id,
      u.email::text,
      p.first_name,
      p.surname,
      s.status,
      s.invited_email,
      (select max(r.created_at) from tool_runs r where r.user_id = s.user_id),
      (select count(*) from tool_runs r2
        where r2.user_id = s.user_id and r2.created_at >= date_trunc('month', now())),
      (select coalesce(sum(a.units), 0)::bigint from asset_cost a
        where a.user_id = s.user_id and a.kind = 'image'
          and a.created_at >= date_trunc('month', now()))
    from school_seats s
    left join auth.users u on u.id = s.user_id
    left join profiles p   on p.id = s.user_id
    where s.school_id = sid
      and s.status <> 'free'
    order by s.status, p.surname nulls last;
end;
$$;
revoke execute on function admin_school_staff(uuid) from anon, public;
grant execute on function admin_school_staff(uuid) to authenticated;

-- ── Onboarding checklist ─────────────────────────────────────────────────────
create or replace function admin_school_tasks(sid uuid)
returns table (key text, label text, done boolean, done_at timestamptz, sort integer)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    select t.key, t.label, t.done, t.done_at, t.sort
    from school_onboarding_tasks t
    where t.school_id = sid
    order by t.sort;
end;
$$;
revoke execute on function admin_school_tasks(uuid) from anon, public;
grant execute on function admin_school_tasks(uuid) to authenticated;

create or replace function admin_set_school_task(sid uuid, p_key text, p_done boolean)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_school text;
  v_label  text;
begin
  if not is_admin() then raise exception 'not authorized'; end if;

  update school_onboarding_tasks
     set done = p_done, done_at = case when p_done then now() else null end
   where school_id = sid and key = p_key
  returning label into v_label;

  if v_label is null then raise exception 'no such task'; end if;

  select name into v_school from schools where id = sid;

  perform admin_log(
    case when p_done then 'Completed onboarding step' else 'Reopened onboarding step' end,
    'account', 'school', sid::text, v_school,
    jsonb_build_object('task', p_key, 'label', v_label)
  );
end;
$$;
revoke execute on function admin_set_school_task(uuid, text, boolean) from anon, public;
grant execute on function admin_set_school_task(uuid, text, boolean) to authenticated;
