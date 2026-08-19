-- ── Surface model attribution across the admin console ───────────────────────
--
-- 20260816000000 made the model a per-tool runtime setting and started
-- recording model, reasoning_tokens, cache_write_tokens, effort and verbosity
-- on every token_usage row. This migration makes that data readable.
--
-- Before this, `model` was selected by exactly two functions (admin_tools and
-- admin_model_routing) and reasoning_tokens by one. Every other admin surface
-- reading token_usage was model-blind — so during a model rollout, a cost
-- change could not be attributed to the model, the effort setting, or a growth
-- in reasoning tokens. That attribution is the entire point of the columns.
--
-- WHY EACH FUNCTION IS DROPPED FIRST.
-- All three gain columns in their RETURNS TABLE. Postgres rejects that with
-- `create or replace` alone:
--     ERROR: 42P13: cannot change return type of existing function
-- so each is dropped and recreated. Dropping also discards the function's
-- grants, which is why every revoke/grant pair below is restated — omitting
-- them would leave the RPC unreachable by the authenticated role.
--
-- Nothing here adds a column, migrates data, or touches RLS. These are purely
-- additive reads over columns 20260816000000 already created.

-- ── 1. admin_model_routing(): group by (model, effort), expose reasoning ─────
--
-- The single highest-value change here. Previously grouped by model alone, so
-- it could say "terra costs more than gpt-4o" but never why.
--
-- Grouping by (model, effort) splits one model into a row per effort setting
-- actually used. That is what turns the card into an answer to the real
-- question during a rollout: did cost move because we changed model, or because
-- someone raised effort? gpt-4o rows carry effort IS NULL and collapse into a
-- single '—' row, so nothing changes visually until a gpt-5.6 tool runs.
--
-- reasoning_tokens matters because it is billed AS output and is already
-- counted inside completion_tokens. The existing total_tokens column therefore
-- silently conflates answer and thinking on gpt-5.6 rows; returning the split
-- lets the card show a reasoning share rather than mislead.
--
-- cache_write_tokens (gpt-5.6 explicit caching, billed at 1.25x input) was
-- recorded by 20260816000000 and read by nothing at all until now.
--
-- The text-only caveat documented at 20260812130012:209-228 still applies
-- unchanged: asset_cost has no model dimension, so the two totals are still
-- returned for the card's footnote.
drop function if exists admin_model_routing();

create or replace function admin_model_routing()
returns table (
  model              text,
  effort             text,
  runs               bigint,
  total_tokens       bigint,
  reasoning_tokens   bigint,
  cache_write_tokens bigint,
  cost_usd           numeric,
  cost_per_run       numeric,
  tools              bigint,
  text_total_usd     numeric,
  all_in_total_usd   numeric
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
      -- Not coalesced to a literal here: the UI decides how to render "this
      -- model has no effort setting", and a text placeholder in the data would
      -- be indistinguishable from a real effort named '—'.
      tu.effort,
      count(*),
      sum(tu.prompt_tokens + tu.completion_tokens),
      coalesce(sum(tu.reasoning_tokens), 0),
      coalesce(sum(tu.cache_write_tokens), 0),
      sum(tu.cost_usd),
      sum(tu.cost_usd) / greatest(count(*), 1),
      count(distinct tu.tool_slug),
      max(tt.text_total),
      max(tt.text_total + tt.asset_total)
    from token_usage tu
    cross join totals tt
    where tu.created_at >= date_trunc('month', now())
    group by tu.model, tu.effort
    order by 7 desc;
end;
$$;
revoke execute on function admin_model_routing() from anon, public;
grant execute on function admin_model_routing() to authenticated;

-- ── 2. admin_tool_usage_report(): which models ran this tool ────────────────
--
-- Drives the per-tool detail page (/admin/usage/[slug]), which showed total
-- tokens and cost but never which model produced them — so a mid-month switch
-- was invisible on the one page dedicated to that tool.
--
-- array_agg(distinct model) is the same aggregate admin_tools() already uses,
-- so the two pages describe a tool's routing identically. It collects models
-- within the existing `group by tool_slug` without changing the row count, so
-- every current consumer of this function is unaffected.
drop function if exists admin_tool_usage_report();

create or replace function admin_tool_usage_report()
returns table (
  tool_slug text,
  generations bigint,
  total_tokens bigint,
  reasoning_tokens bigint,
  models text[],
  text_cost_usd numeric,
  asset_cost_usd numeric,
  cost_usd numeric,
  last_used timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    with t as (
      select tu.tool_slug, count(*) as generations,
        sum(tu.prompt_tokens + tu.completion_tokens) as total_tokens,
        coalesce(sum(tu.reasoning_tokens), 0) as reasoning_tokens,
        array_agg(distinct tu.model) as models,
        sum(tu.cost_usd) as text_cost,
        max(tu.created_at) as last_text
      from token_usage tu
      where tu.created_at >= date_trunc('month', now())
      group by tu.tool_slug
    ),
    a as (
      select ac.tool_slug, sum(ac.cost_usd) as asset_cost, max(ac.created_at) as last_asset
      from asset_cost ac
      where ac.created_at >= date_trunc('month', now())
      group by ac.tool_slug
    )
    select
      coalesce(t.tool_slug, a.tool_slug),
      coalesce(t.generations, 0),
      coalesce(t.total_tokens, 0),
      coalesce(t.reasoning_tokens, 0),
      -- A tool with only image/audio spend has no token_usage row at all, so
      -- the full outer join yields NULL here rather than an empty array.
      coalesce(t.models, array[]::text[]),
      coalesce(t.text_cost, 0),
      coalesce(a.asset_cost, 0),
      coalesce(t.text_cost, 0) + coalesce(a.asset_cost, 0),
      greatest(t.last_text, a.last_asset)
    from t full outer join a on t.tool_slug = a.tool_slug
    order by 8 desc;
end;
$$;
revoke execute on function admin_tool_usage_report() from anon, public;
grant execute on function admin_tool_usage_report() to authenticated;

-- ── 3. admin_recent_runs(): model + cost on the platform-wide feed ──────────
--
-- /admin/activity is the natural "what is running on what right now" screen,
-- and it answered neither question: the function read tool_runs alone and never
-- touched token_usage. During a rollout that is the fastest place to notice a
-- switch behaving badly, so it gets both.
--
-- The cost join is lifted verbatim from admin_teacher_recent_runs
-- (20260811000800:64-80), including its two-branch shape:
--   * run_id present  → exact, joined on run_id
--   * run_id absent   → approximated from a ±1 minute window, for rows written
--                       before run_id existed
-- and its cost_is_exact flag, so an approximated row is labelled rather than
-- silently presented as precise.
--
-- ONE DELIBERATE DIFFERENCE: the fallback keys on r.user_id rather than a uid
-- parameter, because this function is platform-wide. Using a single teacher's
-- id here would attribute other teachers' spend to every row.
drop function if exists admin_recent_runs(integer);

create or replace function admin_recent_runs(lim integer default 50)
returns table (
  id uuid,
  email text,
  tool_slug text,
  title text,
  created_at timestamptz,
  models text[],
  cost_usd numeric,
  cost_is_exact boolean
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
      r.id, u.email::text, r.tool_slug, r.title, r.created_at,
      case
        when r.run_id is not null then
          coalesce((
            select array_agg(distinct tu.model)
            from token_usage tu where tu.run_id = r.run_id
          ), array[]::text[])
        else
          coalesce((
            select array_agg(distinct tu.model)
            from token_usage tu
            where tu.user_id = r.user_id and tu.run_id is null
              and tu.created_at between r.created_at - interval '1 minute'
                                    and r.created_at + interval '1 minute'
          ), array[]::text[])
      end as models,
      case
        when r.run_id is not null then
          coalesce((select sum(tu.cost_usd) from token_usage tu where tu.run_id = r.run_id), 0)
          + coalesce((select sum(ac.cost_usd) from asset_cost ac where ac.run_id = r.run_id), 0)
        else
          coalesce((
            select sum(tu.cost_usd) from token_usage tu
            where tu.user_id = r.user_id and tu.run_id is null
              and tu.created_at between r.created_at - interval '1 minute'
                                    and r.created_at + interval '1 minute'
          ), 0)
          + coalesce((
            select sum(ac.cost_usd) from asset_cost ac
            where ac.user_id = r.user_id and ac.run_id is null
              and ac.created_at between r.created_at - interval '1 minute'
                                    and r.created_at + interval '1 minute'
          ), 0)
      end as cost_usd,
      (r.run_id is not null) as cost_is_exact
    from tool_runs r
    left join auth.users u on u.id = r.user_id
    order by r.created_at desc
    limit lim;
end;
$$;
revoke execute on function admin_recent_runs(integer) from anon, public;
grant execute on function admin_recent_runs(integer) to authenticated;
