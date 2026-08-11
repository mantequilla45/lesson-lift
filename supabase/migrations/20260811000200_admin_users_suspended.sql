-- Expose suspension state to the Teachers tab.
--
-- admin_users() feeds the table (needs a "Suspended" chip and a filter) and
-- admin_teacher_detail() feeds the drawer (needs to know whether the button
-- should read Suspend or Unsuspend, and why the account was suspended).
--
-- Postgres cannot widen a set-returning function's row type in place —
-- `create or replace` fails with "cannot change return type of existing
-- function" — so each is dropped and recreated. Both happen in this one file so
-- the migration's transaction leaves no window where /admin/users is broken.
--
-- The bodies below are copied verbatim from 20260805000800_admin_users_school
-- and 20260804163955_admin_teacher_detail. The ONLY changes are the added
-- suspension columns in the returns clause and select list.

drop function if exists admin_users();
drop function if exists admin_teacher_detail(uuid);

create or replace function admin_users()
returns table (
  id uuid, email text, first_name text, surname text,
  plan text, subscription_status text, is_admin boolean, created_at timestamptz,
  generations bigint, generations_this_month bigint, cost_usd numeric,
  ai_images_this_month bigint, resources_topup bigint, ai_topup bigint,
  school_id uuid, school_name text,
  suspended_at timestamptz
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
      p.school_id, sc.name,
      p.suspended_at
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
  cost_usd numeric,
  suspended_at timestamptz,
  suspended_reason text
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
      coalesce(tu.cost, 0) + coalesce(ac.cost, 0),
      p.suspended_at,
      p.suspended_reason
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
revoke execute on function admin_teacher_detail(uuid) from anon, public;
grant execute on function admin_teacher_detail(uuid) to authenticated;
