-- ── Enforce the fair-use rate limit ──────────────────────────────────────────
--
-- app_settings.rate_limit_per_hour has existed since 20260805001700, with a
-- control in /admin/usage writing to it, and nothing has ever read it. An
-- operator could set it to 1 and watch a teacher generate all day.
--
-- WHERE THIS IS ENFORCED.
-- In this gate rather than a new check, because proxy.ts already calls
-- my_generation_gate() on every cost-bearing POST. A separate rate-limit query
-- would double the gate's round-trips for a number that comes from the same
-- table the gate is already aggregating.
--
-- WHY THE SETTING IS READ HERE RATHER THAN CACHED IN THE APP.
-- Folding it into this query costs one primary-key lookup on a table with
-- fewer than ten rows, which is free beside the two token_usage aggregates
-- already present — and it means the limit is always current, with no TTL to
-- reason about and no per-instance cache to go stale. app_settings is
-- admin-only under RLS; this function is already `security definer`, which is
-- what makes reading it here possible at all.
--
-- COUNTED FROM token_usage, consistently with the daily and monthly caps. It is
-- written server-side by recordUsage(), whereas tool_runs is written by the
-- browser after the stream finishes and can simply be skipped by closing the
-- tab. is_counted_generation() applies the same exclusions, so a slideshow's
-- sub-asset calls do not each burn a slot.
--
-- A ROLLING HOUR, NOT A CLOCK HOUR.
-- `created_at >= now() - interval '1 hour'`. A clock-hour bucket would let
-- someone run the full allowance at 10:59 and the whole allowance again at
-- 11:01 — exactly the burst this limit exists to stop.
--
-- ZERO MEANS UNLIMITED, NOT BLOCKED.
-- A missing row, a null, or a value <= 0 disables the limit rather than
-- blocking everything. The failure mode of a fat-fingered 0 must be "no limit
-- enforced", never "nobody can generate" — this is the one gate in the product
-- that blocks by design, so its accident case has to be the harmless one.
--
-- The index at token_usage (user_id, created_at desc) already serves the
-- rolling-hour predicate; no new index is needed.
--
-- Dropped first: the return type gains two columns.
drop function if exists my_generation_gate();

create or replace function my_generation_gate()
returns table (
  plan            text,
  is_admin        boolean,
  used_today      integer,
  used_month      integer,
  used_hour       integer,
  rate_limit_hour integer,
  spend_pence     bigint,
  credit_pence    bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_limit integer;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- jsonb number -> integer. Coalesced so a deleted row reads as "no limit"
  -- rather than null propagating into the comparison in generation-guard.ts.
  select coalesce((s.value #>> '{}')::integer, 0) into v_limit
    from app_settings s where s.key = 'rate_limit_per_hour';
  v_limit := coalesce(v_limit, 0);

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
      (select count(*)::integer from token_usage t
        where t.user_id = v_uid
          and is_counted_generation(t.tool_slug, t.step)
          and t.created_at >= now() - interval '1 hour'),
      v_limit,
      s.spend_pence,
      s.credit_pence
    from (select 1) _
    left join profiles p on p.id = v_uid
    cross join lateral monthly_ai_spend(v_uid) s;
end;
$$;

grant execute on function my_generation_gate() to authenticated;

comment on function my_generation_gate() is
  'One-shot gate input for proxy.ts: plan, admin flag, generation counts (day/month/rolling hour, global across all tools), the configured hourly rate limit (0 = unlimited), and measured spend/credit in pence.';
