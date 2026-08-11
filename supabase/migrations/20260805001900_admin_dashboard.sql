-- ── Dashboard ────────────────────────────────────────────────────────────────
-- Aggregates across every domain the console now covers. Deliberately reports
-- only figures with a real source: the spec's dashboard also shows paid-ads
-- CAC, cost-per-signup and UTM attribution, and nothing records utm_campaign at
-- signup, so those tiles are omitted rather than invented.

create or replace function admin_dashboard()
returns table (
  -- People
  total_teachers        bigint,
  new_teachers_month    bigint,
  paying_teachers       bigint,
  -- Money (GBP, from plan_config)
  mrr_gbp               numeric,
  b2c_mrr_gbp           numeric,
  b2b_mrr_gbp           numeric,
  -- Schools
  schools_total         bigint,
  schools_live          bigint,
  seats_sold            bigint,
  seats_assigned        bigint,
  -- Cost (USD, from logged usage)
  cost_month_usd        numeric,
  ai_image_cost_usd     numeric,
  generations_month     bigint,
  ai_images_month       bigint,
  -- Support
  open_tickets          bigint,
  high_priority_tickets bigint,
  flags_awaiting        bigint,
  -- Billing
  overdue_invoices      bigint,
  overdue_value_gbp     numeric,
  failed_payments       bigint
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
  select
    (select count(*) from auth.users),
    (select count(*) from auth.users where created_at >= date_trunc('month', now())),
    (select count(*) from profiles where coalesce(plan, 'free') <> 'free'),

    -- Teacher MRR from plan prices, plus school seat revenue at the banded rate.
    (select coalesce(sum(pc.price_monthly), 0)
       from profiles p join plan_config pc on pc.plan_id = coalesce(p.plan, 'free')
      where coalesce(p.plan,'free') not in ('free','school'))
    + (select coalesce(sum(s.seats * seat_rate(s.seats)), 0)
         from schools s where s.status = 'live'),
    (select coalesce(sum(pc.price_monthly), 0)
       from profiles p join plan_config pc on pc.plan_id = coalesce(p.plan, 'free')
      where coalesce(p.plan,'free') not in ('free','school')),
    (select coalesce(sum(s.seats * seat_rate(s.seats)), 0)
       from schools s where s.status = 'live'),

    (select count(*) from schools),
    (select count(*) from schools where status = 'live'),
    (select coalesce(sum(seats), 0)::bigint from schools),
    (select count(*) from school_seats where status in ('assigned','dormant')),

    (select coalesce(sum(t.cost_usd), 0) from token_usage t
      where t.created_at >= date_trunc('month', now()))
    + (select coalesce(sum(a.cost_usd), 0) from asset_cost a
      where a.created_at >= date_trunc('month', now())),
    (select coalesce(sum(a.cost_usd), 0) from asset_cost a
      where a.kind = 'image' and a.created_at >= date_trunc('month', now())),
    (select count(*) from tool_runs r where r.created_at >= date_trunc('month', now())),
    (select coalesce(sum(a.units), 0)::bigint from asset_cost a
      where a.kind = 'image' and a.created_at >= date_trunc('month', now())),

    (select count(*) from support_threads where status = 'open'),
    (select count(*) from support_threads where status <> 'closed' and priority = 'high'),
    (select count(*) from safeguarding_flags where status = 'review'),

    (select count(*) from invoices
      where status = 'overdue'
         or (status = 'sent' and due_at is not null and due_at < current_date)),
    (select coalesce(sum(amount_gbp), 0) from invoices
      where status = 'overdue'
         or (status = 'sent' and due_at is not null and due_at < current_date)),
    (select count(*) from invoices where status = 'failed');
end;
$$;
revoke execute on function admin_dashboard() from anon, public;
grant execute on function admin_dashboard() to authenticated;

-- Signups per month for the last 6 months, for the bar chart.
create or replace function admin_signups_by_month(months integer default 6)
returns table (month_start date, label text, signups bigint)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    select
      d.m::date,
      to_char(d.m, 'Mon'),
      (select count(*) from auth.users u
        where u.created_at >= d.m and u.created_at < d.m + interval '1 month')
    from generate_series(
      date_trunc('month', now()) - ((months - 1) || ' months')::interval,
      date_trunc('month', now()),
      interval '1 month'
    ) as d(m)
    order by d.m;
end;
$$;
revoke execute on function admin_signups_by_month(integer) from anon, public;
grant execute on function admin_signups_by_month(integer) to authenticated;

-- "Needs you today" — the action list. Each row is something a human should
-- do, with a link to where they do it. Ordered by how much it costs to ignore.
create or replace function admin_needs_attention()
returns table (
  kind     text,
  title    text,
  detail   text,
  href     text,
  severity text
)
language plpgsql stable security definer set search_path = public
as $$
declare fx constant numeric := 0.79;
begin
  if not is_admin() then raise exception 'not authorized'; end if;

  return query
  -- Paying teachers whose measured cost exceeds what they pay.
  select 'margin',
         count(*)::text || ' paying teacher' || case when count(*) = 1 then '' else 's' end
           || ' cost more than they pay',
         'Offer them a higher plan or an AI top-up before the month closes.',
         '/admin/usage', 'high'
  from (
    select p.id
    from profiles p
    join plan_config pc on pc.plan_id = coalesce(p.plan, 'free')
    where coalesce(p.plan,'free') <> 'free'
      and not coalesce(p.is_admin, false)
      and coalesce(pc.price_monthly, 0) > 0
      and coalesce(pc.price_monthly, 0) < fx * (
        (select coalesce(sum(t.cost_usd),0) from token_usage t
          where t.user_id = p.id and t.created_at >= date_trunc('month', now()))
        + (select coalesce(sum(a.cost_usd),0) from asset_cost a
          where a.user_id = p.id and a.created_at >= date_trunc('month', now())))
  ) x
  having count(*) > 0

  union all
  select 'tickets',
         count(*)::text || ' ticket' || case when count(*) = 1 then '' else 's' end
           || ' marked high priority',
         'Teachers waiting on an answer.',
         '/admin/inbox', 'high'
  from support_threads where status <> 'closed' and priority = 'high'
  having count(*) > 0

  union all
  select 'unassigned',
         count(*)::text || ' unassigned ticket' || case when count(*) = 1 then '' else 's' end,
         'Nobody has picked these up.',
         '/admin/inbox', 'normal'
  from support_threads where status = 'open' and assigned_to is null
  having count(*) > 0

  union all
  select 'flags',
         count(*)::text || ' safeguarding flag' || case when count(*) = 1 then '' else 's' end
           || ' awaiting review',
         'Schools will ask how quickly these are handled.',
         '/admin/flags', 'high'
  from safeguarding_flags where status = 'review'
  having count(*) > 0

  union all
  select 'overdue',
         count(*)::text || ' overdue invoice' || case when count(*) = 1 then '' else 's' end,
         'Worth ' || to_char(coalesce(sum(amount_gbp),0), 'FM£999,999.00') || ' — chase before renewal.',
         '/admin/revenue', 'high'
  from invoices
  where status = 'overdue'
     or (status = 'sent' and due_at is not null and due_at < current_date)
  having count(*) > 0

  union all
  select 'failed_payments',
         count(*)::text || ' failed payment' || case when count(*) = 1 then '' else 's' end,
         'Send a card update link before access lapses.',
         '/admin/revenue', 'high'
  from invoices where status = 'failed'
  having count(*) > 0

  -- Schools that bought seats and invited nobody: paid, not using it, will not
  -- renew. The most expensive thing on this list to ignore.
  union all
  select 'idle_school',
         s.name || ' hasn''t started',
         s.seats::text || ' seats bought, nobody invited yet.',
         '/admin/schools', 'high'
  from schools s
  where s.status <> 'paused'
    and not exists (
      select 1 from school_seats ss
      where ss.school_id = s.id and ss.status <> 'free'
    )

  union all
  select 'dormant_seats',
         count(*)::text || ' seat' || case when count(*) = 1 then '' else 's' end
           || ' assigned but unused',
         'Dormant seats are renewal risk. Chase before the invoice, not after.',
         '/admin/schools', 'normal'
  from school_seats where status = 'dormant'
  having count(*) > 0

  union all
  select 'copy_drafts',
         count(*)::text || ' unpublished copy change'
           || case when count(*) = 1 then '' else 's' end,
         'Edited but not live.',
         '/admin/copy', 'low'
  from copy_blocks where draft is not null and draft is distinct from value
  having count(*) > 0;
end;
$$;
revoke execute on function admin_needs_attention() from anon, public;
grant execute on function admin_needs_attention() to authenticated;

-- Where the AI money goes this month, by cost type rather than by tool.
create or replace function admin_cost_breakdown()
returns table (label text, cost_usd numeric, units bigint, note text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    select 'AI-generated images',
           coalesce(sum(a.cost_usd), 0),
           coalesce(sum(a.units), 0)::bigint,
           'The single biggest lever on gross margin'
    from asset_cost a
    where a.kind = 'image' and a.created_at >= date_trunc('month', now())
  union all
    select 'Audio',
           coalesce(sum(a.cost_usd), 0),
           coalesce(sum(a.units), 0)::bigint,
           'Slideshow narration'
    from asset_cost a
    where a.kind = 'audio' and a.created_at >= date_trunc('month', now())
  union all
    select 'Text generation',
           coalesce(sum(t.cost_usd), 0),
           count(*)::bigint,
           'Every tool that writes rather than draws'
    from token_usage t
    where t.created_at >= date_trunc('month', now())
  order by 2 desc;
end;
$$;
revoke execute on function admin_cost_breakdown() from anon, public;
grant execute on function admin_cost_breakdown() to authenticated;
