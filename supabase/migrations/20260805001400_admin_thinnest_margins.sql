-- Paying teachers ordered by contribution, worst first. This is the list that
-- protects unit economics: AI-image slideshows cost ~33x a text resource, so a
-- single heavy user on a cheap plan can go underwater without anything else
-- looking wrong.
--
-- Revenue comes from plan_config so a price change is reflected without a code
-- change. Free teachers have no revenue to divide by and report cost only —
-- they are acquisition spend, not a margin problem.
create or replace function admin_thinnest_margins(lim integer default 10)
returns table (
  user_id          uuid,
  teacher          text,
  email            text,
  plan             text,
  revenue_gbp      numeric,
  cost_usd         numeric,
  ai_images        bigint,
  generations      bigint,
  contribution_gbp numeric,
  margin_pct       numeric
)
language plpgsql stable security definer set search_path = public
as $$
declare
  fx constant numeric := 0.79;  -- USD -> GBP, mirrors app/admin/format.ts
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    with usage as (
      select
        u.id,
        coalesce(nullif(trim(coalesce(p.first_name,'') || ' ' || coalesce(p.surname,'')), ''),
                 u.email::text) as name,
        u.email::text as email,
        coalesce(p.plan, 'free') as plan,
        coalesce(pc.price_monthly, 0) as revenue,
        (select coalesce(sum(t.cost_usd), 0) from token_usage t
          where t.user_id = u.id and t.created_at >= date_trunc('month', now()))
        + (select coalesce(sum(a.cost_usd), 0) from asset_cost a
          where a.user_id = u.id and a.created_at >= date_trunc('month', now())) as cost,
        (select coalesce(sum(a2.units), 0)::bigint from asset_cost a2
          where a2.user_id = u.id and a2.kind = 'image'
            and a2.created_at >= date_trunc('month', now())) as images,
        (select count(*) from tool_runs r
          where r.user_id = u.id and r.created_at >= date_trunc('month', now())) as gens
      from auth.users u
      left join profiles p     on p.id = u.id
      left join plan_config pc on pc.plan_id = coalesce(p.plan, 'free')
    )
    select
      us.id, us.name, us.email, us.plan,
      us.revenue,
      us.cost,
      us.images,
      us.gens,
      us.revenue - (us.cost * fx),
      case when us.revenue > 0
           then (us.revenue - (us.cost * fx)) / us.revenue
           else null end
    from usage us
    -- Only teachers who actually generated something: a paying teacher with
    -- zero usage is 100% margin and tells you nothing.
    where us.gens > 0 or us.cost > 0
    order by
      case when us.revenue > 0 then (us.revenue - (us.cost * fx)) / us.revenue else 999 end,
      us.cost desc
    limit lim;
end;
$$;
revoke execute on function admin_thinnest_margins(integer) from anon, public;
grant execute on function admin_thinnest_margins(integer) to authenticated;
