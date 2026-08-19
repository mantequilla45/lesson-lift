-- ── my_tool_usage_report(): dollars → credits ────────────────────────────────
--
-- The teacher-facing usage table was showing provider cost in USD. That is the
-- one number teachers must never see: "you spent $0.41 of AI" next to a £7.99
-- charge invites the reading that they got 41 cents of value for their money,
-- which is wrong (the price buys the product, not a metered resale of tokens)
-- and impossible to argue with once seen. app/lib/plans.ts:248-259 sets out the
-- reasoning, and AllowanceMeter has been credit-based since then. This brings
-- the per-tool report into the same unit.
--
-- WHY THE CONVERSION IS DEFINED HERE AND NOT IN TYPESCRIPT.
-- The enforcement gate converts spend to pence in SQL (monthly_ai_spend, see
-- 20260810000100_cost_ceiling.sql). If the report converted in TS with its own
-- copy of the rate, the meter and the table could disagree about the same
-- month's spend with nothing to catch it — the exact failure mode
-- 20260812000600_fx_rate_single_source.sql was written to eliminate for FX. So
-- the report reuses fx_usd_to_gbp() and the new pence_per_credit() below, and
-- the two units meet in exactly one place each.
--
-- WHY CREDITS ARE RETURNED UNROUNDED.
-- Rounding each tool's credits independently would mean the per-tool rows do
-- not sum to the total: 401.6 + 198.5 + 50.7 rounds to 402 + 199 + 51 = 652,
-- but the true total 650.8 rounds to 651. A teacher who adds up the column and
-- gets a different answer from the footer has found a bug, and no footnote will
-- convince them otherwise. Returning numeric and rounding once at display keeps
-- rows and footer arithmetically consistent.
--
-- A residual sub-credit gap remains between this table's footer and the
-- AllowanceMeter, because monthly_ai_spend() round()s to whole pence before its
-- credit conversion (it needs a bigint to compare against an integer ceiling).
-- That is left alone deliberately: monthly_ai_spend is the enforcement gate and
-- must not be perturbed to make a report tidier. The two figures also live on
-- different tabs, so they are never read side by side.

-- ── Pence of AI spend per teacher-facing credit ──────────────────────────────
-- Mirrors PENCE_PER_CREDIT in app/lib/plans.ts — change both together.
--
-- Deliberately a FUNCTION, not a settings table, unlike fx_rate. The FX rate
-- got a table because a human reviews it quarterly against a real market rate
-- and the provenance (reviewed_at) matters. This is a product-pricing constant:
-- it only ever moves alongside PLAN_CREDITS, TOPUP_PENCE and the pricing-page
-- copy, all of which ship in a deploy. A row an admin could edit independently
-- of that deploy would silently desynchronise the credit figure from the number
-- of credits the pricing page promises — a hazard dressed as a feature.
--
-- immutable + parallel safe so Postgres inlines it into the report below.
create or replace function pence_per_credit()
returns numeric
language sql
immutable
parallel safe
as $$
  select 0.15::numeric;
$$;

grant execute on function pence_per_credit() to authenticated;

comment on function pence_per_credit() is
  'Pence of measured AI spend per teacher-facing credit. Mirrors PENCE_PER_CREDIT in app/lib/plans.ts — change both together. See the credits rationale in app/lib/plans.ts.';

-- ── The report ───────────────────────────────────────────────────────────────
-- DROP first: the return shape changes (three *_usd columns become three
-- *_credits columns), and `create or replace function` cannot change a
-- RETURNS TABLE signature — it fails with
--     ERROR: 42P13: cannot change return type of existing function
-- Same gotcha as documented at 20260613000100_create_asset_cost.sql. Dropping
-- also discards the function's grants, which is why the grant is restated at
-- the foot.
--
-- The full outer join is unchanged: a tool with only assets (an image-only run)
-- or only text must still appear. So is the month window — date_trunc('month',
-- now()) — which matches monthly_ai_spend() so the two cover the same period.
--
-- total_tokens is retained in the shape but is NOT rendered any more: token
-- counts are provider-shaped detail with no teacher meaning. Kept only because
-- dropping it buys nothing and this migration already changes the signature.
drop function if exists my_tool_usage_report();

create function my_tool_usage_report()
returns table (
  tool_slug     text,
  generations   bigint,
  total_tokens  bigint,
  -- Credits, UNROUNDED. Round at display, once, after summing. See the header.
  text_credits  numeric,
  asset_credits numeric,
  credits       numeric
)
language sql
stable
security invoker
as $$
  with
  -- Hoisted so the rate functions are evaluated once per statement rather than
  -- once per row. fx_usd_to_gbp() is STABLE (it reads fx_rate), so this is also
  -- the only form that guarantees every row used the same rate.
  rate as (
    select (fx_usd_to_gbp() * 100 / pence_per_credit()) as credits_per_usd
  ),
  t as (
    select
      tool_slug,
      count(*) as generations,
      sum(prompt_tokens + completion_tokens) as total_tokens,
      sum(cost_usd) as text_cost
    from token_usage
    where user_id = auth.uid()
      and created_at >= date_trunc('month', now())
    group by tool_slug
  ),
  a as (
    select
      tool_slug,
      sum(cost_usd) as asset_cost
    from asset_cost
    where user_id = auth.uid()
      and created_at >= date_trunc('month', now())
    group by tool_slug
  )
  select
    coalesce(t.tool_slug, a.tool_slug) as tool_slug,
    coalesce(t.generations, 0) as generations,
    coalesce(t.total_tokens, 0) as total_tokens,
    coalesce(t.text_cost, 0)  * r.credits_per_usd as text_credits,
    coalesce(a.asset_cost, 0) * r.credits_per_usd as asset_credits,
    (coalesce(t.text_cost, 0) + coalesce(a.asset_cost, 0)) * r.credits_per_usd as credits
  from t
  full outer join a on t.tool_slug = a.tool_slug
  cross join rate r
  order by 6 desc;
$$;

grant execute on function my_tool_usage_report() to authenticated;

comment on function my_tool_usage_report() is
  'Per-tool AI usage for the caller, current calendar month, in teacher-facing CREDITS. Credits are unrounded numeric on purpose so per-tool rows sum to the displayed total — round once at display. security invoker: RLS on token_usage/asset_cost scopes it to the caller.';

-- ── Remove the teacher-facing usage DELETE policies ──────────────────────────
-- These were added by 20260613000200_usage_delete_policies.sql for one reason:
-- the "Reset" button on /account/usage, which let a teacher clear a tool's
-- recorded usage. That button is gone.
--
-- It has to go, and so do these policies, because token_usage and asset_cost
-- are exactly the rows monthly_ai_spend() sums to enforce the monthly AI spend
-- ceiling. A teacher who deletes them has reset their own credit balance — and
-- with the policies in place that is doable with the anon key and any REST
-- client, no UI required. Removing the button alone would only hide it.
--
-- The admin reset path is unaffected: admin_reset_tool_usage() is
-- security definer and bypasses RLS entirely.
--
-- Note both tables were created append-only; this restores that property.
drop policy if exists "own usage delete" on token_usage;
drop policy if exists "own asset cost delete" on asset_cost;
