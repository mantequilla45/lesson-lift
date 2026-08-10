-- Add the teacher's school to admin_users() so the Teachers table can stop
-- hardcoding "Individual" in its School column, and its school filter (which
-- shipped `disabled title="No school data yet"`) can be enabled.
--
-- Postgres can't widen a set-returning function's row type in place, so the old
-- signature is dropped first. Safe: read-only function, no data of its own.
drop function if exists admin_users();

create or replace function admin_users()
returns table (
  id uuid, email text, first_name text, surname text,
  plan text, subscription_status text, is_admin boolean, created_at timestamptz,
  generations bigint, generations_this_month bigint, cost_usd numeric,
  ai_images_this_month bigint, resources_topup bigint, ai_topup bigint,
  school_id uuid, school_name text
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    select
      u.id, u.email::text, p.first_name, p.surname, p.plan, p.subscription_status,
      coalesce(p.is_admin, false), u.created_at,
      coalesce(r.gens, 0), coalesce(rm.gens, 0),
      coalesce(tu.cost, 0) + coalesce(ac.cost, 0),
      coalesce(img.units, 0),
      coalesce(gr.resource_topup, 0), coalesce(gr.ai_topup, 0),
      p.school_id, sc.name
    from auth.users u
    left join profiles p on p.id = u.id
    left join schools sc on sc.id = p.school_id
    left join (select tr.user_id, count(*) as gens from tool_runs tr group by tr.user_id) r
      on r.user_id = u.id
    left join (
      select tr2.user_id, count(*) as gens from tool_runs tr2
      where tr2.created_at >= date_trunc('month', now()) group by tr2.user_id
    ) rm on rm.user_id = u.id
    left join (select t2.user_id, sum(t2.cost_usd) as cost from token_usage t2 group by t2.user_id) tu
      on tu.user_id = u.id
    left join (select a2.user_id, sum(a2.cost_usd) as cost from asset_cost a2 group by a2.user_id) ac
      on ac.user_id = u.id
    left join (
      select a3.user_id, sum(a3.units)::bigint as units from asset_cost a3
      where a3.kind = 'image' and a3.created_at >= date_trunc('month', now())
      group by a3.user_id
    ) img on img.user_id = u.id
    left join (
      select g.user_id,
        sum(g.amount) filter (where g.kind = 'resource')::bigint as resource_topup,
        sum(g.amount) filter (where g.kind = 'ai_image')::bigint as ai_topup
      from allowance_grants g
      where g.created_at >= date_trunc('month', now())
        and (g.expires_at is null or g.expires_at > now())
      group by g.user_id
    ) gr on gr.user_id = u.id
    order by u.created_at desc;
end;
$$;
revoke execute on function admin_users() from anon, public;
grant execute on function admin_users() to authenticated;
