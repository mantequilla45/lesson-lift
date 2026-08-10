-- Adds an approximate per-run cost to admin_teacher_recent_runs, for the
-- Teachers drawer's activity timeline. tool_runs has no foreign key to
-- token_usage/asset_cost (they're written separately — see app/lib/usage.ts),
-- so this matches by user_id + tool_slug + nearest created_at within a
-- 2-minute window, which is how long a single generation realistically takes
-- end to end. Good enough to show next to an activity line; NOT an
-- authoritative accounting join — use admin_teacher_detail's cost_usd (a
-- real sum) for anything that needs to add up exactly.
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
      coalesce(
        (
          select tu.cost_usd
          from token_usage tu
          where tu.user_id = uid
            and tu.tool_slug = r.tool_slug
            and tu.created_at between r.created_at - interval '2 minutes' and r.created_at + interval '2 minutes'
          order by abs(extract(epoch from (tu.created_at - r.created_at)))
          limit 1
        ),
        0
      ) + coalesce(
        (
          select ac.cost_usd
          from asset_cost ac
          where ac.user_id = uid
            and ac.tool_slug = r.tool_slug
            and ac.created_at between r.created_at - interval '2 minutes' and r.created_at + interval '2 minutes'
          order by abs(extract(epoch from (ac.created_at - r.created_at)))
          limit 1
        ),
        0
      ) as approx_cost_usd
    from tool_runs r
    where r.user_id = uid
    order by r.created_at desc
    limit lim;
end;
$$;
grant execute on function admin_teacher_recent_runs(uuid, integer) to authenticated;
