-- Headline figures for the Usage & margins page, matching the layout in
-- docs/jooma-admin-console.html. Every number is measured from token_usage +
-- asset_cost, not modelled from the cost sheet.
create or replace function admin_usage_summary()
returns table (
  ai_spend_usd        numeric,
  ai_image_cost_usd   numeric,
  text_cost_usd       numeric,
  generations         bigint,
  ai_images           bigint,
  active_teachers     bigint,
  cost_per_active_usd numeric,
  mrr_gbp             numeric,
  gross_margin        numeric
)
language plpgsql stable security definer set search_path = public
as $$
declare fx constant numeric := 0.79;
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
  with spend as (
    select
      (select coalesce(sum(t.cost_usd),0) from token_usage t
        where t.created_at >= date_trunc('month', now())) as text_cost,
      (select coalesce(sum(a.cost_usd),0) from asset_cost a
        where a.created_at >= date_trunc('month', now())) as asset_cost_total,
      (select coalesce(sum(a.cost_usd),0) from asset_cost a
        where a.kind = 'image' and a.created_at >= date_trunc('month', now())) as image_cost,
      (select coalesce(sum(a.units),0)::bigint from asset_cost a
        where a.kind = 'image' and a.created_at >= date_trunc('month', now())) as images,
      (select count(*) from tool_runs r
        where r.created_at >= date_trunc('month', now())) as gens,
      -- "Active" means generated something this month, not merely registered.
      -- Dividing cost by total signups would flatter the per-teacher figure.
      (select count(distinct r.user_id) from tool_runs r
        where r.created_at >= date_trunc('month', now())) as active,
      (select coalesce(sum(pc.price_monthly),0)
         from profiles p join plan_config pc on pc.plan_id = coalesce(p.plan,'free')
        where coalesce(p.plan,'free') not in ('free','school'))
      + (select coalesce(sum(s.seats * seat_rate(s.seats)),0)
           from schools s where s.status = 'live') as mrr
  )
  select
    s.text_cost + s.asset_cost_total,
    s.image_cost,
    s.text_cost,
    s.gens,
    s.images,
    s.active,
    case when s.active > 0 then (s.text_cost + s.asset_cost_total) / s.active else 0 end,
    s.mrr,
    -- Gross margin on subscription revenue after measured AI cost only. Card
    -- fees and overheads are excluded — this is the AI-cost lever, not a P&L.
    case when s.mrr > 0
         then (s.mrr - (s.text_cost + s.asset_cost_total) * fx) / s.mrr
         else null end
  from spend s;
end;
$$;
revoke execute on function admin_usage_summary() from anon, public;
grant execute on function admin_usage_summary() to authenticated;
