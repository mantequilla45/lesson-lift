-- ── Per-run cost: sum the whole generation, not one row of it ────────────────
--
-- admin_teacher_recent_runs picked the single NEAREST token_usage row and the
-- single nearest asset_cost row (`order by ... limit 1`). That was roughly
-- right when a generation meant one model call, but it under-reports anything
-- that spends more than once — which is every slideshow deck, now that decks
-- write a tool_runs row at all.
--
-- Measured against a real deck on staging:
--   what the drawer showed   $0.0307   (one token row)
--   what it actually cost    $0.0740   ($0.0359 tokens + $0.0381 images)
-- a 59% under-report on the most expensive thing the product does.
--
-- Three separate causes, all fixed here:
--
--   1. `limit 1` instead of sum(). A deck writes three token rows ('Deck
--      text', 'Audio script', 'YouTube') plus one asset_cost row per image.
--
--   2. The join required tu.tool_slug = r.tool_slug. Images for a deck are
--      recorded by the sub-route that generated them, not under
--      'generate-slideshow', so matching on slug dropped them entirely. Cost
--      is attributed by user and time window only.
--
--   3. The window was ±2 minutes on both sides. With slug matching gone that
--      is wide enough to swallow a neighbouring generation, so it tightens to
--      ±1 minute — the same window admin_teacher_activity already uses, so the
--      drawer's timeline and the full activity log finally agree.
--
-- Still an approximation, not an accounting join: tool_runs has no foreign key
-- to token_usage/asset_cost. For a figure that must add up exactly, use
-- admin_teacher_detail's cost_usd, which is a real sum over the whole account.

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
          and tu.created_at between r.created_at - interval '1 minute'
                               and r.created_at + interval '1 minute'
      ), 0)
      + coalesce((
        select sum(ac.cost_usd)
        from asset_cost ac
        where ac.user_id = uid
          and ac.created_at between r.created_at - interval '1 minute'
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
