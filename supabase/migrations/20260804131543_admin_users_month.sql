-- admin_users() only returned lifetime generation counts, but the admin
-- Teachers table needs a "resources this month" column that lines up with the
-- same monthly window the free-plan generation cap uses (see plans.ts /
-- generation-guard.ts). Add generations_this_month alongside the existing
-- lifetime count rather than replacing it.
--
-- Adding an OUT column changes the return type, which `create or replace`
-- rejects (42P13) — so the old signature has to be dropped first. This only
-- surfaces on a database replaying the history from scratch; on staging the
-- function already had the wider shape, so the replace was a no-op.
drop function if exists admin_users();
create or replace function admin_users()
returns table (
  id uuid,
  email text,
  first_name text,
  surname text,
  plan text,
  subscription_status text,
  is_admin boolean,
  created_at timestamptz,
  generations bigint,
  generations_this_month bigint,
  cost_usd numeric
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
      u.id,
      u.email::text,
      p.first_name,
      p.surname,
      p.plan,
      p.subscription_status,
      coalesce(p.is_admin, false),
      u.created_at,
      coalesce(r.gens, 0),
      coalesce(rm.gens, 0),
      coalesce(tu.cost, 0) + coalesce(ac.cost, 0)
    from auth.users u
    left join profiles p on p.id = u.id
    left join (select tr.user_id, count(*) as gens from tool_runs tr group by tr.user_id) r on r.user_id = u.id
    left join (
      select tr2.user_id, count(*) as gens
      from tool_runs tr2
      where tr2.created_at >= date_trunc('month', now())
      group by tr2.user_id
    ) rm on rm.user_id = u.id
    left join (select t2.user_id, sum(t2.cost_usd) as cost from token_usage t2 group by t2.user_id) tu on tu.user_id = u.id
    left join (select a2.user_id, sum(a2.cost_usd) as cost from asset_cost a2 group by a2.user_id) ac on ac.user_id = u.id
    order by u.created_at desc;
end;
$$;
grant execute on function admin_users() to authenticated;
