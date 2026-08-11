-- ── Per-run cost: use a window that actually fits a generation ───────────────
--
-- The ±1 minute window truncated most decks. Measured over the 21 decks on
-- staging, a single deck's spend spans:
--
--   average  127s      max  403s
--
-- because a deck is five separate spends, not one: Deck text and the YouTube
-- search early, the Audio script and its TTS render in the middle, then one
-- image per slide trickling in at the end. A ±60s window captured the middle
-- and dropped the tails — on the deck inspected by hand it missed two rows at
-- −72s and −70s.
--
-- Widening is safe here because decks are far apart in practice: the average
-- gap between one teacher's decks is ~27 hours, and only 1 of 17 consecutive
-- pairs were closer than 3 minutes. The risk of truncating a real deck is much
-- larger than the risk of absorbing a neighbour.
--
-- The window is ASYMMETRIC, and that is the point. tool_runs is written by the
-- BROWSER once the stream finishes (see the comment at the top of
-- app/lib/usage.ts — usage only exists inside the route handler, so cost
-- telemetry is written server-side into its own table). Every cost row for a
-- run therefore lands BEFORE the run row exists. Looking 6 minutes back and
-- only 1 minute forward covers the slowest observed deck while barely
-- overlapping whatever the teacher does next.
--
-- This remains an approximation. The exact fix is to give the generation an id
-- the route can stamp on each cost row, and have the client send that id with
-- the run — worth doing, but it changes the telemetry contract on every tool,
-- so it is deliberately not bundled with a reporting fix. Until then,
-- admin_teacher_detail's cost_usd stays the figure that adds up exactly.

drop function if exists admin_teacher_recent_runs(uuid, integer);
create or replace function admin_teacher_recent_runs(uid uuid, lim integer default 10)
returns table (
  id uuid,
  tool_slug text,
  title text,
  created_at timestamptz,
  approx_cost_usd numeric
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
      r.id,
      r.tool_slug,
      r.title,
      r.created_at,
      coalesce((
        select sum(tu.cost_usd)
        from token_usage tu
        where tu.user_id = uid
          and tu.created_at between r.created_at - interval '6 minutes'
                               and r.created_at + interval '1 minute'
      ), 0)
      + coalesce((
        select sum(ac.cost_usd)
        from asset_cost ac
        where ac.user_id = uid
          and ac.created_at between r.created_at - interval '6 minutes'
                               and r.created_at + interval '1 minute'
      ), 0) as approx_cost_usd
    from tool_runs r
    where r.user_id = uid
    order by r.created_at desc
    limit lim;
end;
$$;
revoke execute on function admin_teacher_recent_runs(uuid, integer) from anon, public;
grant execute on function admin_teacher_recent_runs(uuid, integer) to authenticated;

-- Same window in the full activity log, so the two surfaces keep agreeing.
create or replace function admin_teacher_activity(
  uid uuid,
  lim integer default 50,
  off integer default 0
)
returns table (
  id              uuid,
  tool_slug       text,
  title           text,
  created_at      timestamptz,
  approx_cost_usd numeric,
  total_count     bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    with runs as (
      select r.id, r.tool_slug, r.title, r.created_at
      from tool_runs r
      where r.user_id = uid
    ),
    total as (select count(*) as n from runs),
    page as (
      select * from runs order by runs.created_at desc limit lim offset off
    )
    select
      rp.id,
      rp.tool_slug,
      rp.title,
      rp.created_at,
      coalesce((
        select sum(t.cost_usd) from token_usage t
        where t.user_id = uid
          and t.created_at between rp.created_at - interval '6 minutes'
                               and rp.created_at + interval '1 minute'
      ), 0)
      + coalesce((
        select sum(a.cost_usd) from asset_cost a
        where a.user_id = uid
          and a.created_at between rp.created_at - interval '6 minutes'
                               and rp.created_at + interval '1 minute'
      ), 0),
      (select total.n from total)
    from page rp
    order by rp.created_at desc;
end;
$$;
revoke execute on function admin_teacher_activity(uuid, integer, integer) from anon, public;
grant execute on function admin_teacher_activity(uuid, integer, integer) to authenticated;
