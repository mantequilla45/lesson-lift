-- Powers the Teachers drawer: one profile's full picture (billing fields not
-- exposed by admin_users(), plus contact info) and their own recent activity.
-- Split into two RPCs rather than one wide join so the drawer can render the
-- profile immediately and stream in activity separately if it's ever slow.

create or replace function admin_teacher_detail(uid uuid)
returns table (
  id uuid,
  email text,
  first_name text,
  surname text,
  dial_code text,
  phone text,
  country text,
  plan text,
  subscription_status text,
  stripe_customer_id text,
  current_period_end timestamptz,
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
      p.dial_code,
      p.phone,
      p.country,
      p.plan,
      p.subscription_status,
      p.stripe_customer_id,
      p.current_period_end,
      coalesce(p.is_admin, false),
      u.created_at,
      coalesce(r.gens, 0),
      coalesce(rm.gens, 0),
      coalesce(tu.cost, 0) + coalesce(ac.cost, 0)
    from auth.users u
    left join profiles p on p.id = u.id
    left join (select tr.user_id, count(*) as gens from tool_runs tr where tr.user_id = uid group by tr.user_id) r on r.user_id = u.id
    left join (
      select tr2.user_id, count(*) as gens
      from tool_runs tr2
      where tr2.user_id = uid and tr2.created_at >= date_trunc('month', now())
      group by tr2.user_id
    ) rm on rm.user_id = u.id
    left join (select t2.user_id, sum(t2.cost_usd) as cost from token_usage t2 where t2.user_id = uid group by t2.user_id) tu on tu.user_id = u.id
    left join (select a2.user_id, sum(a2.cost_usd) as cost from asset_cost a2 where a2.user_id = uid group by a2.user_id) ac on ac.user_id = u.id
    where u.id = uid;
end;
$$;
grant execute on function admin_teacher_detail(uuid) to authenticated;

-- This teacher's own recent generations, most recent first.
create or replace function admin_teacher_recent_runs(uid uuid, lim integer default 10)
returns table (
  id uuid,
  tool_slug text,
  title text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    select r.id, r.tool_slug, r.title, r.created_at
    from tool_runs r
    where r.user_id = uid
    order by r.created_at desc
    limit lim;
end;
$$;
grant execute on function admin_teacher_recent_runs(uuid, integer) to authenticated;
