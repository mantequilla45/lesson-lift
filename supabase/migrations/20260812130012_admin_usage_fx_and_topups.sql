-- ── Make the Usage & margins money numbers true ──────────────────────────────
--
-- Three fixes, one migration, because they are one story: every figure on
-- /admin/usage was measured from real usage, and three of them were still
-- wrong for reasons that had nothing to do with the measurement.
--
--   1. Thinnest margins counted subscription revenue and ignored top-ups.
--   2. Both margin functions hardcoded the FX rate that 20260812000600 had
--      just made a single source of truth.
--   3. Model routing reported text spend under a heading the page reads as
--      total AI spend.

-- ── 1 + 2. Thinnest margins: top-up revenue, and the real FX rate ────────────
--
-- BUG ONE: REVENUE IGNORED TOP-UPS.
-- Revenue was plan_config.price_monthly and nothing else. But a teacher who
-- reaches the £1.50 spend ceiling can buy £1.50 of AI credit
-- (/api/stripe/topup -> webhook -> topup_purchases + allowance_grants), and can
-- do it repeatedly. That purchase does two things at once: it is REVENUE, and
-- it RAISES their allowance so they may legitimately spend more.
--
-- Counting the extra cost without the extra revenue made this page report a
-- collapsing margin for precisely the customers behaving best — someone who ran
-- out and paid again rather than churning. Worse, a FREE teacher who bought a
-- top-up reported revenue 0 and margin null, rendering as "free plan", so the
-- one free user who had actually handed us money was filed as acquisition
-- spend. That is now the case this page most needs to get right.
--
-- Only kind='credit_gbp' counts. topup_purchases also permits 'resource' and
-- 'ai_image', but those packs were withdrawn (20260812000500) and, unlike
-- credit, they never raised the AI spend ceiling — including them would put
-- revenue and allowance on different footings.
--
-- The window is this month, matching the cost window below. Credit expires at
-- month end and never rolls over, so a top-up bought in July funds nothing in
-- August and must not flatter August's margin.
--
-- BUG TWO: FX WAS HARDCODED.
-- `fx constant numeric := 0.79` predates the fx_rate table (20260812000600),
-- which made fx_usd_to_gbp() authoritative. With the literal in place,
-- admin_set_fx_rate() moved the spend ceiling and the teacher-facing figures
-- but NOT this table — so after any rate change the margin report and the
-- enforcement gate would quietly disagree, with nothing to catch it.
--
-- The plan and top-up components are returned separately as well as summed, so
-- the console can show "£7.99 + £1.50 top-up" rather than an unexplained £9.49
-- that reconciles against no price on the Plans page.
--
-- Dropped first: the return type gains two columns, and Postgres refuses to
-- `create or replace` a set-returning function whose signature changed.
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
  -- change from the constant it replaces.
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
        (select coalesce(sum(tp.price_gbp), 0) from topup_purchases tp
          where tp.user_id = u.id
            and tp.kind = 'credit_gbp'
            and tp.created_at >= date_trunc('month', now())) as topup_revenue,
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
      -- WITH a top-up now has one, and gets a real percentage.
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

-- ── 2 (cont). Headline summary: the real FX rate ─────────────────────────────
-- Same hardcoded-0.79 bug as above. The signature is unchanged, so this one can
-- be replaced in place.
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
-- Was `fx constant numeric := 0.79`. See the note on admin_thinnest_margins
-- above: the rate is the fx_rate table's to decide, not this function's.
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
      (select coalesce(sum(pc.price_monthly),0)
         from profiles p join plan_config pc on pc.plan_id = coalesce(p.plan,'free')
        where coalesce(p.plan,'free') not in ('free','school'))
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

-- ── 3. Model routing: say what it does NOT include ───────────────────────────
--
-- This function groups token_usage by model. That is accurate — but it is only
-- the TEXT half of the bill. Image and audio spend lives in asset_cost, which
-- has no model dimension: there is nothing to group by, and no routing decision
-- to make, because you cannot send an image generation to gpt-4o-mini.
--
-- The consequence was a card whose column total silently disagreed with the
-- "AI spend this month" stat directly above it on the same page, with no
-- explanation offered. An admin comparing the two reasonably concludes that one
-- of them is broken.
--
-- Rather than invent pseudo-model rows for images and audio — which would leave
-- total_tokens, avg_tokens and cost_per_run structurally meaningless on exactly
-- those rows — the function now also returns the two totals so the card can
-- state the gap in a footnote. The table stays honest about being text-only;
-- the footnote makes that visible instead of implied.
--
-- Both totals are constants for the month, repeated on every row. That is
-- deliberate: it saves the page a fifth round-trip for two numbers.
drop function if exists admin_model_routing();

create or replace function admin_model_routing()
returns table (
  model            text,
  runs             bigint,
  total_tokens     bigint,
  cost_usd         numeric,
  cost_per_run     numeric,
  tools            bigint,
  text_total_usd   numeric,
  all_in_total_usd numeric
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    with totals as (
      select
        (select coalesce(sum(t.cost_usd),0) from token_usage t
          where t.created_at >= date_trunc('month', now())) as text_total,
        (select coalesce(sum(a.cost_usd),0) from asset_cost a
          where a.created_at >= date_trunc('month', now())) as asset_total
    )
    select
      tu.model,
      count(*),
      sum(tu.prompt_tokens + tu.completion_tokens),
      sum(tu.cost_usd),
      sum(tu.cost_usd) / greatest(count(*), 1),
      count(distinct tu.tool_slug),
      max(tt.text_total),
      max(tt.text_total + tt.asset_total)
    from token_usage tu
    cross join totals tt
    where tu.created_at >= date_trunc('month', now())
    group by tu.model
    order by 4 desc;
end;
$$;
revoke execute on function admin_model_routing() from anon, public;
grant execute on function admin_model_routing() to authenticated;
