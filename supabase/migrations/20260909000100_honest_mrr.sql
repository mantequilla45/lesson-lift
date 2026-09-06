-- ── MRR that counts money actually arriving ──────────────────────────────────
--
-- admin_dashboard() computed teacher MRR as
--
--   sum(plan_config.price_monthly) for every profile whose plan <> 'free'
--
-- which reads no Stripe state whatsoever. Three ways that overstates:
--
--   1. COMPS. An admin granting Pro writes plan='pro' and fakes
--      subscription_status='active' with no card on file (see
--      app/api/admin/teachers/change-plan, case 1). That teacher contributed a
--      full GBP 7.99 to "recurring revenue" while paying nothing. Measured on
--      production: 3 Pro profiles, all reading 'active', only 2 with a real
--      subscription.
--
--   2. SUBSCRIPTIONS ALREADY ENDING. A teacher who has cancelled keeps access
--      to the end of the period, so plan and status both stay put and the row
--      is indistinguishable from a renewing one here. On production BOTH live
--      subscriptions were in this state; on staging, 1 of 4.
--
--   3. DISCOUNTS. Checkout sets allow_promotion_codes, and nothing anywhere
--      persists what was actually charged against a subscription. The two live
--      production subscribers list at GBP 7.99 and are billed GBP 0.08 and
--      GBP 0.80.
--
-- This migration fixes 1 and 2, which are answerable from our own columns, and
-- reports them separately rather than silently dropping them. 3 needs Stripe
-- and is done in the dashboard page (loadTrueMrr), which falls back to the
-- figure computed here when Stripe cannot be reached.
--
-- THE DISCRIMINATOR
--
-- There is no is_comped column. `stripe_subscription_id IS NULL` is the honest
-- test: syncSubscription() always writes one for a real subscriber, and the
-- comp path never does. `subscription_status` is NOT usable — a comp sets it to
-- 'active' by hand.

-- Shared so the dashboard and the usage summary cannot drift. They carried
-- copies of the same MRR query, and fixing one alone would have made the two
-- admin pages disagree about the same number.
--
-- A teacher counts as paying when they have a real Stripe subscription, are on
-- a paid teacher plan, are not scheduled to cancel, and are not an admin.
-- Admins on paid plans were previously counted here, though
-- admin_thinnest_margins already excluded them.
create or replace function teacher_mrr()
returns table (
  paying_gbp     numeric,
  paying_count   bigint,
  comped_gbp     numeric,
  comped_count   bigint,
  ending_gbp     numeric,
  ending_count   bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with paid as (
    select
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
    count(*)            filter (where has_sub and ending)
  from paid;
$$;

revoke all on function teacher_mrr() from public, anon;
grant execute on function teacher_mrr() to authenticated;

comment on function teacher_mrr() is
  'Teacher subscription revenue split three ways: genuinely paying, comped by an admin (no Stripe subscription), and paying but set to cancel. List prices from plan_config; actual discounted amounts need Stripe. Excludes admins.';


-- ── admin_dashboard(), with the split surfaced ───────────────────────────────
--
-- Three new columns rather than a quietly corrected total, so nothing vanishes
-- from the money view: an admin can still see how much is being given away and
-- how much is walking out of the door.
drop function if exists admin_dashboard();

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
  comped_mrr_gbp        numeric,
  comped_teachers       bigint,
  ending_mrr_gbp        numeric,
  ending_teachers       bigint,
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
    -- Only teachers actually being billed. Comps and cancellations are counted
    -- in their own columns below.
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


-- ── admin_usage_summary(), kept in step ──────────────────────────────────────
--
-- Same MRR, via the same function. These two RPCs previously carried identical
-- copies of the old query; the whole point of teacher_mrr() is that they can no
-- longer disagree.
--
-- Rebuilt from 20260812130012_admin_usage_fx_and_topups.sql with only the two
-- MRR expressions changed. Top-up income stays OUT of mrr_gbp and out of the
-- margin, as that migration argues at length: a GBP 1.50 purchase must not make
-- a headline recurring figure jump and read as a trend.
-- Signature unchanged from 20260812130012, so this replaces in place. The ONLY
-- edit is the `mrr` expression inside the CTE: everything else, including the
-- fx handling and the gross-margin note, is carried over verbatim.
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
      -- "Active" means generated something this month, not merely registered.
      -- Dividing cost by total signups would flatter the per-teacher figure.
      (select count(distinct r.user_id) from tool_runs r
        where r.created_at >= date_trunc('month', now())) as active,
      -- CHANGED: was sum(price_monthly) over every non-free profile, which
      -- counted comped teachers and ones already cancelling. Now the shared
      -- teacher_mrr(), so this and admin_dashboard() cannot disagree.
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
    -- Gross margin on subscription revenue after measured AI cost only. Card
    -- fees and overheads are excluded — this is the AI-cost lever, not a P&L.
    --
    -- Note this is deliberately SUBSCRIPTION revenue only, unlike the per-teacher
    -- figures above: top-up income is real but lumpy, and folding it into a
    -- headline gross-margin percentage would make the number jump on a £1.50
    -- purchase and read as a trend when it is not.
    case when s.mrr > 0
         then (s.mrr - (s.text_cost + s.asset_cost_total) * fx) / s.mrr
         else null end
  from spend s;
end;
$$;

revoke execute on function admin_usage_summary() from anon, public;
grant execute on function admin_usage_summary() to authenticated;
