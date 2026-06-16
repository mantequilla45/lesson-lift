-- Capture each deck's cost breakdown (deck text, per-slide AI images, audio)
-- next to its all-in cost, so the admin Usage detail page can expand a single
-- slideshow and show where its cost came from. The component split is only
-- knowable at generation time (the asset/token rows can't be tied back to one
-- deck), so we store it here as JSON. Older rows have a null breakdown.
alter table slide_cost add column if not exists breakdown jsonb;

-- Recreate admin_slide_costs to surface the new column. Adding an OUT column
-- changes the return signature, which `create or replace` rejects — drop first.
-- Shape of `breakdown`:
--   { "text": <usd>, "audio": <usd>,
--     "images": [ { "label": <slide title>, "cost_usd": <usd>, "count": <n> } ] }
drop function if exists admin_slide_costs();
create or replace function admin_slide_costs()
returns table (slide_label text, cost_usd numeric, created_at timestamptz, breakdown jsonb)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  -- One row per slideshow generation (deck title + all-in cost + breakdown),
  -- newest first.
  return query
    select sc.slide_label, sc.cost_usd, sc.created_at, sc.breakdown
    from slide_cost sc
    where sc.created_at >= date_trunc('month', now())
    order by sc.created_at desc;
end;
$$;
grant execute on function admin_slide_costs() to authenticated;
