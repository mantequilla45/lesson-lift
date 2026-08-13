-- ── Thinnest margins: don't count refunded top-ups as revenue ────────────────
--
-- 20260812130012 started counting top-up purchases as revenue, which was right:
-- a teacher who buys £1.50 of AI credit has paid us £1.50, and their margin
-- should reflect it.
--
-- But a REFUNDED top-up is not revenue. The money went back.
--
-- The refund path (syncRefund in app/api/stripe/webhook/route.ts) marks the
-- INVOICE refunded and claws back any unspent credit — but it deliberately
-- leaves the topup_purchases row in place, because that row is the idempotency
-- gate keyed on stripe_payment_intent_id. Deleting it would let a replayed
-- Stripe webhook re-grant credit for a payment that had been given back. So
-- the purchase row is a permanent record that a payment was ATTEMPTED and
-- processed, not proof that we kept the money.
--
-- Without this fix a refunded teacher shows revenue they did not ultimately
-- provide, and their margin reads better than it is — the exact direction of
-- error this page exists to prevent.
--
-- HOW THE JOIN WORKS, AND WHY IT IS NOT AN FK.
-- topup_purchases has no invoice_id; the two tables are linked only by what the
-- webhook writes for the same payment. Both rows are created together in
-- handleTopUp() with the same user, the same amount, and type='topup'. So a
-- purchase is treated as refunded when that user has a refunded top-up invoice
-- for the same amount in the same month.
--
-- That is a coarse match: a teacher who bought two £1.50 top-ups in one month
-- and had exactly one refunded would have BOTH discounted. This is deliberate.
-- The alternative — counting a refunded purchase as revenue — overstates income
-- and flatters margin, and if this page is going to be wrong at the edges it
-- should be wrong in the direction that makes you look harder at a teacher
-- rather than ignore one. Multiple top-ups in a month with a partial refund is
-- also rare enough to be worth the simplicity; if it stops being rare, add
-- invoice_id to topup_purchases and join on it properly.
--
-- Note syncRefund only mirrors FULL refunds (a partial leaves the invoice as
-- paid, see its comment), so a partially refunded top-up still counts in full
-- here. Same reasoning: there is nowhere honest to record a partial yet.
--
-- Dropped first: `create or replace` cannot change a returns-table signature,
-- and while the columns are unchanged here, the drop keeps this migration
-- replayable against either previous version of the function.
drop function if exists admin_thinnest_margins(integer);

create or replace function admin_thinnest_margins(lim integer default 10)
returns table (
  user_id           uuid,
  teacher           text,
  email             text,
  plan              text,
  is_admin          boolean,
  revenue_gbp       numeric,
  plan_revenue_gbp  numeric,
  topup_revenue_gbp numeric,
  cost_usd          numeric,
  ai_images         bigint,
  generations       bigint,
  contribution_gbp  numeric,
  margin_pct        numeric
)
language plpgsql stable security definer set search_path = public
as $$
declare
  -- Read once per call rather than once per row. fx_usd_to_gbp() is STABLE (it
  -- reads fx_rate), so hoisting it into a local is both correct and the minimal
  -- change from the constant it replaced.
  fx numeric := fx_usd_to_gbp();
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    with usage as (
      select
        u.id,
        coalesce(nullif(trim(coalesce(p.first_name,'') || ' ' || coalesce(p.surname,'')), ''),
                 u.email::text) as name,
        u.email::text as email,
        coalesce(p.plan, 'free') as plan,
        -- Admins bypass the generation cap entirely (generation-guard.ts
        -- returns null before any limit check), so their usage is not
        -- comparable to a teacher's and must be labelled as such.
        coalesce(p.is_admin, false) as is_admin,
        coalesce(pc.price_monthly, 0) as plan_revenue,
        -- Top-ups bought THIS MONTH only, matching the cost window below.
        -- Credit expires at month end and never rolls over, so a top-up bought
        -- in July funds nothing in August and must not flatter August's margin.
        --
        -- Refunded ones are excluded: the money went back, so it is not revenue.
        (select coalesce(sum(tp.price_gbp), 0) from topup_purchases tp
          where tp.user_id = u.id
            and tp.kind = 'credit_gbp'
            and tp.created_at >= date_trunc('month', now())
            and not exists (
              select 1 from invoices inv
               where inv.user_id = tp.user_id
                 and inv.type = 'topup'
                 and inv.status = 'refunded'
                 and inv.amount_gbp = tp.price_gbp
                 and inv.created_at >= date_trunc('month', now())
            )) as topup_revenue,
        (select coalesce(sum(t.cost_usd), 0) from token_usage t
          where t.user_id = u.id and t.created_at >= date_trunc('month', now()))
        + (select coalesce(sum(a.cost_usd), 0) from asset_cost a
          where a.user_id = u.id and a.created_at >= date_trunc('month', now())) as cost,
        (select coalesce(sum(a2.units), 0)::bigint from asset_cost a2
          where a2.user_id = u.id and a2.kind = 'image'
            and a2.created_at >= date_trunc('month', now())) as images,
        (select count(*) from tool_runs r
          where r.user_id = u.id and r.created_at >= date_trunc('month', now())) as gens
      from auth.users u
      left join profiles p     on p.id = u.id
      left join plan_config pc on pc.plan_id = coalesce(p.plan, 'free')
    ),
    totals as (
      select us.*, (us.plan_revenue + us.topup_revenue) as revenue from usage us
    )
    select
      t.id, t.name, t.email, t.plan, t.is_admin,
      t.revenue,
      t.plan_revenue,
      t.topup_revenue,
      t.cost,
      t.images,
      t.gens,
      t.revenue - (t.cost * fx),
      -- A free teacher with no top-up still has no denominator and reports null
      -- ("free plan" in the UI) — they remain acquisition spend. A free teacher
      -- WITH a top-up now has one, and gets a real percentage. A free teacher
      -- whose only top-up was refunded correctly falls back to null.
      case when t.revenue > 0
           then (t.revenue - (t.cost * fx)) / t.revenue
           else null end
    from totals t
    -- Only teachers who actually generated something: a paying teacher with
    -- zero usage is 100% margin and tells you nothing.
    where t.gens > 0 or t.cost > 0
    order by
      case when t.revenue > 0 then (t.revenue - (t.cost * fx)) / t.revenue else 999 end,
      t.cost desc
    limit lim;
end;
$$;
revoke execute on function admin_thinnest_margins(integer) from anon, public;
grant execute on function admin_thinnest_margins(integer) to authenticated;

-- Supports the not-exists lookup above, which runs once per teacher per page
-- load. Without it that is a sequential scan of invoices for every row.
create index if not exists invoices_user_type_status_idx
  on invoices (user_id, type, status);
