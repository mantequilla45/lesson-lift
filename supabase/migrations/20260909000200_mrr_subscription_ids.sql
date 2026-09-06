-- ── Make the Stripe figure count the same people as the SQL one ──────────────
--
-- 20260909000100 fixed the SQL half of MRR: comps, cancellations and admin
-- accounts are excluded and reported separately. The dashboard then replaces
-- that list-price figure with a live total from Stripe, because a discounted
-- subscriber is billed nothing like their plan's price.
--
-- Those two halves counted DIFFERENT POPULATIONS, which made the dashboard
-- incoherent: on staging it showed GBP 46.95 next to "1 paying teacher" and
-- "GBP 7.99 cancelling". The Stripe side summed every active subscription on
-- the account, because it had nothing to filter by:
--
--   - two of the five belong to admin/staff accounts the SQL excludes
--   - one is the cancelling subscriber the SQL reports separately
--   - one belongs to no current profile at all
--   - and one teacher has TWO active subscriptions, so a per-subscription sum
--     can never be reconciled against a per-teacher count
--
-- The fix is to tell the Stripe side exactly which subscriptions to count.
-- teacher_mrr() already decides who is genuinely paying; it now returns their
-- subscription ids so loadTrueMrr() can sum those and nothing else.
--
-- A teacher with two subscriptions is deliberately counted twice in the money
-- and once in the head count: both charges are real revenue, and dropping one
-- would understate what is actually arriving. The head count is a count of
-- teachers, not of subscriptions, and they are allowed to differ.

drop function if exists teacher_mrr();

create or replace function teacher_mrr()
returns table (
  paying_gbp     numeric,
  paying_count   bigint,
  comped_gbp     numeric,
  comped_count   bigint,
  ending_gbp     numeric,
  ending_count   bigint,
  -- The Stripe subscription ids of the teachers counted in paying_count, so a
  -- live total can be taken over exactly this population. Empty rather than
  -- null when nobody is paying, so the caller never has to guard it.
  paying_sub_ids text[]
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- ADMIN ONLY, and this is new.
  --
  -- 20260909000100 left this ungated because nothing outside admin_dashboard()
  -- and admin_usage_summary() called it, and both check for themselves. The
  -- dashboard page now calls it directly to get paying_sub_ids, which makes it
  -- reachable by any signed-in teacher through PostgREST: it is security
  -- definer, so without this check it would hand out company revenue and a list
  -- of live Stripe subscription ids to anybody with an account.
  if not is_admin() then raise exception 'not authorized'; end if;

  return query
  with paid as (
    select
      p.stripe_subscription_id                        as sub_id,
      p.stripe_subscription_id is not null            as has_sub,
      coalesce(p.cancel_at_period_end, false)         as ending,
      coalesce(pc.price_monthly, 0)                   as price
    from profiles p
    join plan_config pc on pc.plan_id = coalesce(p.plan, 'free')
    where coalesce(p.plan, 'free') not in ('free', 'school')
      and coalesce(p.is_admin, false) = false
  )
  select
    coalesce(sum(price) filter (where has_sub and not ending), 0),
    count(*)            filter (where has_sub and not ending),
    -- No subscription behind the plan: comped by an admin.
    coalesce(sum(price) filter (where not has_sub), 0),
    count(*)            filter (where not has_sub),
    -- Paying now, but cancelling. Real revenue this month, gone next.
    coalesce(sum(price) filter (where has_sub and ending), 0),
    count(*)            filter (where has_sub and ending),
    coalesce(
      array_agg(sub_id) filter (where has_sub and not ending),
      array[]::text[]
    )
  from paid;
end;
$$;

revoke all on function teacher_mrr() from public, anon;
grant execute on function teacher_mrr() to authenticated;

comment on function teacher_mrr() is
  'Teacher subscription revenue split three ways: genuinely paying, comped by an admin (no Stripe subscription), and paying but set to cancel. List prices from plan_config; paying_sub_ids names the subscriptions a live Stripe total must be restricted to, so both figures describe the same people. Excludes admins.';


-- admin_dashboard() and admin_usage_summary() both `select * into` a record
-- from teacher_mrr(), so the new column reaches them without either function
-- changing. They are recreated anyway: dropping the function above invalidates
-- them, and a stale plan would fail on next call.
--
-- Bodies are unchanged from 20260909000100.
create or replace function admin_dashboard()
returns table (
  total_teachers        bigint,
  new_teachers_month    bigint,
  paying_teachers       bigint,
  mrr_gbp               numeric,
  b2c_mrr_gbp           numeric,
  b2b_mrr_gbp           numeric,
  comped_mrr_gbp        numeric,
  comped_teachers       bigint,
  ending_mrr_gbp        numeric,
  ending_teachers       bigint,
  schools_total         bigint,
  schools_live          bigint,
  seats_sold            bigint,
  seats_assigned        bigint,
  cost_month_usd        numeric,
  ai_image_cost_usd     numeric,
  generations_month     bigint,
  ai_images_month       bigint,
  open_tickets          bigint,
  high_priority_tickets bigint,
  flags_awaiting        bigint,
  overdue_invoices      bigint,
  overdue_value_gbp     numeric,
  failed_payments       bigint
)
language plpgsql stable security definer set search_path = public
as $$
declare
  m record;
  seats numeric;
begin
  if not is_admin() then raise exception 'not authorized'; end if;

  select * into m from teacher_mrr();
  select coalesce(sum(s.seats * seat_rate(s.seats)), 0) into seats
    from schools s where s.status = 'live';

  return query
  select
    (select count(*) from auth.users),
    (select count(*) from auth.users where created_at >= date_trunc('month', now())),
    m.paying_count,

    m.paying_gbp + seats,
    m.paying_gbp,
    seats,
    m.comped_gbp,
    m.comped_count,
    m.ending_gbp,
    m.ending_count,

    (select count(*) from schools),
    (select count(*) from schools where status = 'live'),
    (select coalesce(sum(s2.seats), 0)::bigint from schools s2),
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


create or replace function admin_usage_summary()
returns table (
  ai_spend_usd        numeric,
  ai_image_cost_usd   numeric,
  text_cost_usd       numeric,
  generations         bigint,
  ai_images           bigint,
  active_teachers     bigint,
  cost_per_active_usd numeric,
  mrr_gbp             numeric,
  gross_margin        numeric
)
language plpgsql stable security definer set search_path = public
as $$
declare fx numeric := fx_usd_to_gbp();
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
  with spend as (
    select
      (select coalesce(sum(t.cost_usd),0) from token_usage t
        where t.created_at >= date_trunc('month', now())) as text_cost,
      (select coalesce(sum(a.cost_usd),0) from asset_cost a
        where a.created_at >= date_trunc('month', now())) as asset_cost_total,
      (select coalesce(sum(a.cost_usd),0) from asset_cost a
        where a.kind = 'image' and a.created_at >= date_trunc('month', now())) as image_cost,
      (select coalesce(sum(a.units),0)::bigint from asset_cost a
        where a.kind = 'image' and a.created_at >= date_trunc('month', now())) as images,
      (select count(*) from tool_runs r
        where r.created_at >= date_trunc('month', now())) as gens,
      (select count(distinct r.user_id) from tool_runs r
        where r.created_at >= date_trunc('month', now())) as active,
      (select paying_gbp from teacher_mrr())
      + (select coalesce(sum(s.seats * seat_rate(s.seats)),0)
           from schools s where s.status = 'live') as mrr
  )
  select
    s.text_cost + s.asset_cost_total,
    s.image_cost,
    s.text_cost,
    s.gens,
    s.images,
    s.active,
    case when s.active > 0 then (s.text_cost + s.asset_cost_total) / s.active else 0 end,
    s.mrr,
    case when s.mrr > 0
         then (s.mrr - (s.text_cost + s.asset_cost_total) * fx) / s.mrr
         else null end
  from spend s;
end;
$$;

revoke execute on function admin_usage_summary() from anon, public;
grant execute on function admin_usage_summary() to authenticated;
