-- ── Cost ceiling, daily free cap, and purchased credit ───────────────────────
-- Implements the launch pricing model:
--
--   Free  — 1 generation a calendar day (UTC) AND at most 5 a month. Both caps
--           are GLOBAL across all tools, not per tool. The monthly cap is a hard
--           ceiling: at 5 used, blocked until the 1st even on a fresh day.
--   Pro   — £7.99/mo with a £1.50 ceiling on MEASURED provider spend. This is a
--           margin guard, not a unit allowance, so it is denominated in real
--           cost (token_usage + asset_cost) rather than a generation count.
--           Every route that records cost counts against it automatically.
--
-- When a Pro user hits £1.50 they are hard-blocked and offered a £1.50 top-up,
-- repeatable without limit. Purchased credit is stored as an allowance_grants
-- row and expires at the end of the month — it never rolls over.

-- ── FX: single SQL source of truth ───────────────────────────────────────────
-- The 0.79 rate was previously copy-pasted into three admin functions and three
-- TS files. New code reads it from here; the existing admin functions are
-- migrated separately so a mistake in a report can't be confused with a
-- mistake in enforcement.
create or replace function fx_usd_to_gbp()
returns numeric
language sql
immutable
parallel safe
as $$ select 0.79::numeric $$;

grant execute on function fx_usd_to_gbp() to authenticated;

comment on function fx_usd_to_gbp() is
  'USD -> GBP. Mirrors FX_USD_TO_GBP in app/admin/format.ts — change both together.';

-- ── Purchased credit ─────────────────────────────────────────────────────────
-- A third grant kind alongside 'resource' and 'ai_image'.
--
-- NOTE: `amount` is PENCE for kind='credit_gbp' (£1.50 -> 150), because the
-- column is integer and £1.50 is not a whole number of pounds. Adding a numeric
-- column instead would give allowance_grants two competing amount fields and
-- break admin_grant_allowance's cap logic, so the unit varies by kind.
alter table allowance_grants drop constraint if exists allowance_grants_kind_check;
alter table allowance_grants
  add constraint allowance_grants_kind_check
  check (kind in ('resource', 'ai_image', 'credit_gbp'));

-- Same widening for the purchase ledger. topup_purchases.pack_id is already
-- nullable, so a credit purchase with no topup_packs row is legal — packs are
-- unit-denominated and a GBP credit doesn't fit that shape.
alter table topup_purchases drop constraint if exists topup_purchases_kind_check;
alter table topup_purchases
  add constraint topup_purchases_kind_check
  check (kind in ('resource', 'ai_image', 'credit_gbp'));

-- ── Hot-path indexes ─────────────────────────────────────────────────────────
-- The spend aggregate below now runs on every gated generation POST. The
-- existing indexes lead with (user_id, tool_slug), which only prefix-matches
-- these predicates; these are the narrow ones for user+month scans.
create index if not exists token_usage_user_month_idx on token_usage (user_id, created_at desc);
create index if not exists asset_cost_user_month_idx  on asset_cost  (user_id, created_at desc);

-- ── Measured spend + available credit, in pence ──────────────────────────────
-- Deliberately does NOT read slide_cost: that table is a derived per-deck
-- rollup of the same spend already in token_usage + asset_cost, so including
-- it would double-count every slideshow.
create or replace function monthly_ai_spend(uid uuid)
returns table (
  spend_pence  bigint,
  credit_pence bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- Same guard as monthly_allowance: a teacher may read their own, an admin
  -- may read anyone's. security definer makes this the only thing standing
  -- between a caller and someone else's spend — do not simplify it.
  if uid <> auth.uid() and not is_admin() then
    raise exception 'not authorized';
  end if;

  return query
    select
      round(fx_usd_to_gbp() * 100 * (
        (select coalesce(sum(t.cost_usd), 0) from token_usage t
          where t.user_id = uid
            and t.created_at >= date_trunc('month', now()))
      + (select coalesce(sum(a.cost_usd), 0) from asset_cost a
          where a.user_id = uid
            and a.created_at >= date_trunc('month', now()))
      ))::bigint,
      -- Credit is bounded twice: granted this month, and not yet expired.
      -- Both hold for a month-end expiry, which is what "no rollover" means.
      (select coalesce(sum(g.amount), 0)::bigint from allowance_grants g
        where g.user_id = uid
          and g.kind = 'credit_gbp'
          and g.created_at >= date_trunc('month', now())
          and (g.expires_at is null or g.expires_at > now()));
end;
$$;

grant execute on function monthly_ai_spend(uuid) to authenticated;

-- ── What counts as one generation ────────────────────────────────────────────
-- Counted from token_usage, which recordUsage() writes SERVER-side, rather than
-- tool_runs, which the browser writes after a stream finishes. At 5/month the
-- client-side leak was tolerable; at 1/day a page refresh before the save fires
-- would defeat the cap entirely.
--
-- Two filters, both load-bearing (verified against staging data 2026-08-10):
--   * Utility/sub-asset slugs are excluded — they spend money but aren't a
--     generation. Mirrors the exclusion list in app/lib/generation-guard.ts.
--   * generate-slideshow writes THREE rows per deck ('Deck text', 'Audio
--     script', 'YouTube'). Counting them all would burn three of a free user's
--     five on one deck; counting none (step is null alone) would make the most
--     expensive tool in the product free. 'Deck text' is exactly one row per
--     deck, so it is the deck's primary call.
create or replace function is_counted_generation(p_tool_slug text, p_step text)
returns boolean
language sql
immutable
parallel safe
as $$
  select p_tool_slug not in (
           'modify', 'generate-image', 'generate-audio', 'generate-outline',
           'generate-activity', 'suggest-vocabulary', 'edit-text',
           'suggest-subject', 'generate-lesson-outline', 'find-youtube',
           'extract-resource'
         )
     and (p_step is null or p_step = 'Deck text');
$$;

grant execute on function is_counted_generation(text, text) to authenticated;

-- ── Today's generation count ─────────────────────────────────────────────────
-- Mirrors the existing my_generation_count_this_month(). The UTC coercion is
-- explicit so a future change to the session TimeZone can't silently shift when
-- the daily allowance resets.
create or replace function my_generation_count_today()
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::integer
  from token_usage t
  where t.user_id = auth.uid()
    and is_counted_generation(t.tool_slug, t.step)
    and t.created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
$$;

grant execute on function my_generation_count_today() to authenticated;

-- ── The gate ─────────────────────────────────────────────────────────────────
-- Everything proxy.ts needs to decide one request, in a single round-trip. It
-- previously made two (profiles select + count RPC); adding spend would have
-- made three.
create or replace function my_generation_gate()
returns table (
  plan          text,
  is_admin      boolean,
  used_today    integer,
  used_month    integer,
  spend_pence   bigint,
  credit_pence  bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  return query
    select
      coalesce(p.plan, 'free'),
      coalesce(p.is_admin, false),
      (select count(*)::integer from token_usage t
        where t.user_id = v_uid
          and is_counted_generation(t.tool_slug, t.step)
          and t.created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'),
      (select count(*)::integer from token_usage t
        where t.user_id = v_uid
          and is_counted_generation(t.tool_slug, t.step)
          and t.created_at >= date_trunc('month', now())),
      s.spend_pence,
      s.credit_pence
    from (select 1) _
    left join profiles p on p.id = v_uid
    cross join lateral monthly_ai_spend(v_uid) s;
end;
$$;

grant execute on function my_generation_gate() to authenticated;

comment on function my_generation_gate() is
  'One-shot gate input for proxy.ts: plan, admin flag, generation counts (global across all tools) and measured spend/credit in pence.';

-- ── Plan catalogue ───────────────────────────────────────────────────────────
-- Max is withdrawn from sale. The row stays (and keeps its £14.99 price) so
-- admin MRR figures still reconcile for any account holding plan='max'; the
-- 'max' value also stays in the profiles/plan_config CHECK constraints for the
-- same reason. School is not shippable — seats, pooled allowances and central
-- billing are unimplemented — so it moves to draft rather than live.
update plan_config set status = 'retired', updated_at = now() where plan_id = 'max';
update plan_config set status = 'draft',   updated_at = now() where plan_id = 'school';

-- Free's stored copy claimed 10 resources a month; the enforced gate was always
-- 5, and is now 1/day with a 5/month ceiling.
update plan_config
   set description = '1 a day, 5 a month, watermarked',
       monthly_resources = 5,
       updated_at = now()
 where plan_id = 'free';
