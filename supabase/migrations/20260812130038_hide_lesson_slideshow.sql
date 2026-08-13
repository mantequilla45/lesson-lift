-- ── Hide lesson-slideshow from the admin Tools list ──────────────────────────
--
-- lesson-slideshow is an earlier, unlisted slideshow tool. Its route
-- (app/tools/lesson-slideshow), its API handler and its form component are all
-- live, it records real cost, and it counts against a free teacher's monthly
-- quota (GENERATION_PATHS in app/lib/generation-guard.ts) — but it has never
-- appeared in the TOOLS array in app/lib/tools.ts, so it is absent from the
-- teacher grid and reachable only by typing the URL.
--
-- WHY THIS IS A FLAG AND NOT A DELETION.
-- Whether the tool should be removed outright is still being decided. Nothing
-- is deleted here: the route, the API, the component and every historical
-- token_usage / asset_cost / tool_runs row stay exactly where they are. This
-- migration changes one boolean and is reversed with one update:
--
--     update tool_settings set hidden = false where slug = 'lesson-slideshow';
--
-- WHY NOT JUST DELETE THE tool_settings ROW.
-- admin_tools() drives off this table, so deleting the row would make the tool
-- vanish from the admin console while the route stayed live — spend with no
-- listing at all, which is strictly worse than the situation being fixed.
-- Keeping the row preserves its cost attribution.
--
-- WHY NOT JUST SWITCH `enabled` OFF.
-- `enabled` is about to become load-bearing: once tool availability is enforced
-- at the request path, enabled=false will actively block the route. That is a
-- product decision nobody has taken yet. `hidden` is presentational only — it
-- changes what the admin list shows and nothing else.
--
-- HONEST LIMITATION: while hidden, lesson-slideshow remains reachable by direct
-- URL and still spends money. Hiding it from the admin list makes that less
-- visible, not less true. This is a holding position pending a decision, not a
-- fix.

alter table tool_settings
  add column if not exists hidden boolean not null default false;

comment on column tool_settings.hidden is
  'Hides the tool from the admin Tools list without disabling it. For tools whose future is undecided: presentational only, never an enforcement signal. Enforcement reads `enabled`.';

update tool_settings set hidden = true where slug = 'lesson-slideshow';

-- admin_tools() gains a single `where not t.hidden`. Everything else in this
-- function is unchanged from 20260805001300; it is restated in full because
-- Postgres has no way to patch a function body.
create or replace function admin_tools()
returns table (
  slug            text,
  display_name    text,
  enabled         boolean,
  plans           text[],
  model_note      text,
  runs            bigint,
  total_tokens    bigint,
  cost_usd        numeric,
  cost_per_run    numeric,
  avg_tokens      numeric,
  models          text[],
  last_used       timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    with text_usage as (
      select tu.tool_slug,
             count(*)                                     as runs,
             sum(tu.prompt_tokens + tu.completion_tokens) as tokens,
             sum(tu.cost_usd)                             as cost,
             array_agg(distinct tu.model)                 as models,
             max(tu.created_at)                           as last_used
      from token_usage tu
      where tu.created_at >= date_trunc('month', now())
      group by tu.tool_slug
    ),
    asset_usage as (
      select ac.tool_slug,
             sum(ac.cost_usd) as cost,
             max(ac.created_at) as last_used
      from asset_cost ac
      where ac.created_at >= date_trunc('month', now())
      group by ac.tool_slug
    ),
    runs as (
      select r.tool_slug, count(*) as n
      from tool_runs r
      where r.created_at >= date_trunc('month', now())
      group by r.tool_slug
    )
    select
      t.slug,
      coalesce(t.display_name, t.slug),
      t.enabled,
      t.plans,
      t.model_note,
      coalesce(rn.n, tx.runs, 0),
      coalesce(tx.tokens, 0),
      coalesce(tx.cost, 0) + coalesce(au.cost, 0),
      case
        when coalesce(rn.n, tx.runs, 0) > 0
        then (coalesce(tx.cost, 0) + coalesce(au.cost, 0)) / coalesce(rn.n, tx.runs)
        else 0
      end,
      case when coalesce(tx.runs, 0) > 0 then round(tx.tokens::numeric / tx.runs) else 0 end,
      coalesce(tx.models, array[]::text[]),
      greatest(tx.last_used, au.last_used)
    from tool_settings t
    left join text_usage  tx on tx.tool_slug = t.slug
    left join asset_usage au on au.tool_slug = t.slug
    left join runs        rn on rn.tool_slug = t.slug
    where not t.hidden
    order by (coalesce(tx.cost, 0) + coalesce(au.cost, 0)) desc, t.slug;
end;
$$;
revoke execute on function admin_tools() from anon, public;
grant execute on function admin_tools() to authenticated;
