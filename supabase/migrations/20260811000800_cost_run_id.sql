-- ── A real join key for per-run cost ─────────────────────────────────────────
--
-- Until now, cost was attributed to a run by matching user_id and a time
-- window, because tool_runs is written by the BROWSER after a stream finishes
-- while token_usage/asset_cost are written SERVER-side during it (see the
-- comment at the top of app/lib/usage.ts) — the two had nothing in common but
-- a timestamp.
--
-- Every window is wrong in one direction or the other, and a deck makes it
-- obvious. Measured on staging: one deck's spend spans 127s on average and up
-- to 403s across five separate calls (Deck text, YouTube, Audio script, TTS
-- render, one image per slide). So:
--
--   * a narrow window truncates a single deck, understating the most
--     expensive thing the product does;
--   * a wide one swallows the neighbours — three decks generated back to back
--     would each report the sum of all three.
--
-- run_id ends the guessing. The client generates it, sends it with the
-- generation request, and stores it on the tool_runs row; the route stamps it
-- on every cost row it writes. Cost then joins to a run exactly, however fast
-- the teacher generates.
--
-- Nullable and unindexed-by-default on purpose: every historical row has no
-- run_id, and the reporting RPCs fall back to the old time window for those,
-- so this migration changes no existing number.

alter table token_usage add column if not exists run_id uuid;
alter table asset_cost  add column if not exists run_id uuid;
alter table tool_runs   add column if not exists run_id uuid;

-- Partial indexes: only rows that carry a run_id are ever looked up by it.
create index if not exists token_usage_run_idx on token_usage (run_id) where run_id is not null;
create index if not exists asset_cost_run_idx  on asset_cost  (run_id) where run_id is not null;
create index if not exists tool_runs_run_idx   on tool_runs   (run_id) where run_id is not null;

-- ── Reporting: prefer the exact join, fall back to the window ────────────────
-- The fallback is what keeps historical runs showing a sensible figure. It is
-- deliberately the ±1 minute window rather than the wider one: for old rows
-- there is no way to tell a long single deck from two quick ones, and
-- understating is the safer error — it cannot invent spend that never
-- happened.

drop function if exists admin_teacher_recent_runs(uuid, integer);
create or replace function admin_teacher_recent_runs(uid uuid, lim integer default 10)
returns table (
  id uuid,
  tool_slug text,
  title text,
  created_at timestamptz,
  approx_cost_usd numeric,
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
      r.id, r.tool_slug, r.title, r.created_at,
      case
        when r.run_id is not null then
          coalesce((select sum(tu.cost_usd) from token_usage tu where tu.run_id = r.run_id), 0)
          + coalesce((select sum(ac.cost_usd) from asset_cost ac where ac.run_id = r.run_id), 0)
        else
          coalesce((
            select sum(tu.cost_usd) from token_usage tu
            where tu.user_id = uid and tu.run_id is null
              and tu.created_at between r.created_at - interval '1 minute'
                                   and r.created_at + interval '1 minute'
          ), 0)
          + coalesce((
            select sum(ac.cost_usd) from asset_cost ac
            where ac.user_id = uid and ac.run_id is null
              and ac.created_at between r.created_at - interval '1 minute'
                                   and r.created_at + interval '1 minute'
          ), 0)
      end as approx_cost_usd,
      (r.run_id is not null) as cost_is_exact
    from tool_runs r
    where r.user_id = uid
    order by r.created_at desc
    limit lim;
end;
$$;
revoke execute on function admin_teacher_recent_runs(uuid, integer) from anon, public;
grant execute on function admin_teacher_recent_runs(uuid, integer) to authenticated;

drop function if exists admin_teacher_activity(uuid, integer, integer);
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
  cost_is_exact   boolean,
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
      select r.id, r.tool_slug, r.title, r.created_at, r.run_id
      from tool_runs r
      where r.user_id = uid
    ),
    total as (select count(*) as n from runs),
    page as (
      select * from runs order by runs.created_at desc limit lim offset off
    )
    select
      rp.id, rp.tool_slug, rp.title, rp.created_at,
      case
        when rp.run_id is not null then
          coalesce((select sum(t.cost_usd) from token_usage t where t.run_id = rp.run_id), 0)
          + coalesce((select sum(a.cost_usd) from asset_cost a where a.run_id = rp.run_id), 0)
        else
          coalesce((
            select sum(t.cost_usd) from token_usage t
            where t.user_id = uid and t.run_id is null
              and t.created_at between rp.created_at - interval '1 minute'
                                   and rp.created_at + interval '1 minute'
          ), 0)
          + coalesce((
            select sum(a.cost_usd) from asset_cost a
            where a.user_id = uid and a.run_id is null
              and a.created_at between rp.created_at - interval '1 minute'
                                   and rp.created_at + interval '1 minute'
          ), 0)
      end,
      (rp.run_id is not null),
      (select total.n from total)
    from page rp
    order by rp.created_at desc;
end;
$$;
revoke execute on function admin_teacher_activity(uuid, integer, integer) from anon, public;
grant execute on function admin_teacher_activity(uuid, integer, integer) to authenticated;
