-- ── Per-tool model selection ─────────────────────────────────────────────────
--
-- Until now every tool's model was a string literal in its API route, so trying
-- a different model meant a code change and a deploy. This adds the model as a
-- runtime setting alongside `enabled` and `plans`, so a tool can be switched to
-- GPT-5.6 (terra/luna), measured, and reverted from the admin console.
--
-- SEEDED TO CURRENT BEHAVIOUR. Every row is set to the model its route already
-- hardcodes, so applying this migration changes nothing until an admin picks a
-- different model. That is the whole safety property: the deploy is a no-op.
--
-- WHY NO 'sol': gpt-5.6-sol is $5/$30 per 1M — 3x gpt-4o's output rate. It has
-- no plausible fit for these writing tools, so it is deliberately absent from
-- the check constraint rather than merely hidden in the UI.

-- ── 1. tool_settings: the model dimension ────────────────────────────────────

alter table tool_settings
  add column if not exists model     text,
  add column if not exists effort    text,
  add column if not exists verbosity text;

comment on column tool_settings.model is
  'OpenAI model this tool calls. Read at runtime by app/lib/tool-model.ts.';
comment on column tool_settings.effort is
  'reasoning_effort for gpt-5.6 models. NULL for gpt-4o (not a reasoning model).';
comment on column tool_settings.verbosity is
  'verbosity for gpt-5.6 models. NULL for gpt-4o.';

-- ── Register the utility routes that were never in this table ───────────────
--
-- tool_settings was seeded with the teacher-facing tools only. The AI routes
-- behind them — the slideshow's own generator, its audio/YouTube/activity
-- helpers, and the editor utilities — spend real money but had no row, so
-- nothing here could reach them. generate-slideshow is the single most
-- expensive route in the product and had no entry at all.
--
-- WHY A NEW `kind` COLUMN RATHER THAN REUSING `hidden`.
-- `hidden` is documented (20260812130038) as presentational-only, for tools
-- whose future is undecided, and admin_tools() filters those rows OUT. These
-- routes are the opposite case: permanent, load-bearing, and the whole reason
-- this migration exists — hiding them from the page meant to control their
-- model would defeat it. `kind` separates "what is this" from "should it show".
alter table tool_settings
  add column if not exists kind text not null default 'tool';

alter table tool_settings drop constraint if exists tool_settings_kind_chk;
alter table tool_settings add constraint tool_settings_kind_chk
  check (kind in ('tool', 'utility'));

comment on column tool_settings.kind is
  '''tool'' = a teacher picks it from the grid. ''utility'' = an internal AI route called by a tool. Utilities carry a model and cost but are not products; the admin list groups them separately. Distinct from `hidden`, which is presentational.';

-- enabled = true for all of these: switching one off would break its parent
-- tool rather than withdraw a teacher-facing feature, so the kill switch is
-- deliberately left on. They exist here to carry a model, not to be toggled.
insert into tool_settings (slug, display_name, enabled, kind)
values
  ('generate-slideshow',      'Slideshow — deck text',      true, 'utility'),
  ('generate-audio',          'Slideshow — audio script',   true, 'utility'),
  ('find-youtube',            'Slideshow — video search',   true, 'utility'),
  ('generate-activity',       'Slideshow — activity',       true, 'utility'),
  ('generate-lesson-outline', 'Slideshow — lesson outline', true, 'utility'),
  ('suggest-vocabulary',      'Slideshow — vocabulary',     true, 'utility'),
  ('suggest-subject',         'Slideshow — subject match',  true, 'utility'),
  ('extract-resource',        'Resource extractor (PDF)',   true, 'utility'),
  ('edit-text',               'Slide text editor',          true, 'utility'),
  ('generate',                'Comprehension (legacy)',     true, 'utility'),
  ('modify',                  'Modify output',              true, 'utility'),
  ('generate-outline',        'Outline generator',          true, 'utility')
on conflict (slug) do nothing;

-- Seed to the literal each route uses TODAY.
--
-- The gpt-4o vs gpt-4o-2024-08-06 split is deliberate and must be preserved:
-- the dated snapshot is pinned on exactly the routes that use strict
-- json_schema structured outputs, where a floating alias moving to a snapshot
-- with different schema adherence would make JSON.parse throw and hard-fail the
-- tool. Prose degrades gracefully; schemas do not.
update tool_settings set model = 'gpt-4o-mini'
  where slug in ('edit-text', 'suggest-subject');

update tool_settings set model = 'gpt-4o-2024-08-06'
  where slug in ('generate-slideshow', 'generate-audio', 'find-youtube',
                 'extract-resource', 'generate-activity',
                 'generate-lesson-outline', 'suggest-vocabulary');

update tool_settings set model = 'gpt-4o' where model is null;

alter table tool_settings drop constraint if exists tool_settings_model_chk;
alter table tool_settings add constraint tool_settings_model_chk
  check (model in ('gpt-4o', 'gpt-4o-2024-08-06', 'gpt-4o-mini',
                   'gpt-5.6-terra', 'gpt-5.6-luna'));

alter table tool_settings drop constraint if exists tool_settings_effort_chk;
alter table tool_settings add constraint tool_settings_effort_chk
  check (effort is null or effort in ('none','low','medium','high','xhigh','max'));

alter table tool_settings drop constraint if exists tool_settings_verbosity_chk;
alter table tool_settings add constraint tool_settings_verbosity_chk
  check (verbosity is null or verbosity in ('low','medium','high'));

-- ── 2. token_usage: make reasoning spend visible ─────────────────────────────
--
-- gpt-5.6 bills reasoning tokens AS output tokens, so they are already inside
-- completion_tokens and cost_usd stays correct without any change. But folded
-- in like that they are invisible: a tool that got expensive gives no clue
-- whether the answer grew or the thinking did. These columns split that out.
--
-- cache_write_tokens is new in gpt-5.6's explicit prompt caching and bills at
-- 1.25x input. Absent on gpt-4o responses, hence the 0 default.
alter table token_usage
  add column if not exists reasoning_tokens   integer not null default 0,
  add column if not exists cache_write_tokens integer not null default 0,
  add column if not exists effort    text,
  add column if not exists verbosity text;

comment on column token_usage.reasoning_tokens is
  'Subset of completion_tokens spent on reasoning (gpt-5.6). Already billed as output.';
comment on column token_usage.cache_write_tokens is
  'Prompt tokens written to explicit cache (gpt-5.6), billed at 1.25x input.';
comment on column token_usage.effort is
  'reasoning_effort in force for this call, so a cost change can be attributed to a setting change.';

-- ── 3. admin_tools(): expose config + averages for cost projection ───────────
--
-- avg_prompt_tokens / avg_completion_tokens let the admin UI project what a
-- given model WOULD cost for this specific tool before committing to it. This
-- matters because terra is not uniformly cheaper: its output rate ($12/1M) is
-- above gpt-4o's ($10/1M), so on output-heavy tools it can cost more.
-- Dropped first: this adds columns to the RETURNS TABLE, and Postgres rejects
-- that with `create or replace` alone ("cannot change return type of existing
-- function"). The drop discards the function's grants, so both the revoke and
-- the grant are restated after the body.
drop function if exists admin_tools();

create or replace function admin_tools()
returns table (
  slug                  text,
  display_name          text,
  enabled               boolean,
  plans                 text[],
  model_note            text,
  kind                  text,
  model                 text,
  effort                text,
  verbosity             text,
  runs                  bigint,
  total_tokens          bigint,
  cost_usd              numeric,
  cost_per_run          numeric,
  avg_tokens            numeric,
  avg_prompt_tokens     numeric,
  avg_completion_tokens numeric,
  reasoning_tokens      bigint,
  models                text[],
  last_used             timestamptz
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
             sum(tu.prompt_tokens)                        as prompt_tokens,
             sum(tu.completion_tokens)                    as completion_tokens,
             sum(tu.reasoning_tokens)                     as reasoning_tokens,
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
      t.kind,
      t.model,
      t.effort,
      t.verbosity,
      coalesce(rn.n, tx.runs, 0),
      coalesce(tx.tokens, 0),
      coalesce(tx.cost, 0) + coalesce(au.cost, 0),
      case
        when coalesce(rn.n, tx.runs, 0) > 0
        then (coalesce(tx.cost, 0) + coalesce(au.cost, 0)) / coalesce(rn.n, tx.runs)
        else 0
      end,
      case when coalesce(tx.runs, 0) > 0 then round(tx.tokens::numeric / tx.runs) else 0 end,
      -- Averages come from token_usage's own run count, never tool_runs': the
      -- client-written history table can miss rows, which would inflate the
      -- per-run average and overstate every projected cost.
      case when coalesce(tx.runs, 0) > 0 then round(tx.prompt_tokens::numeric / tx.runs) else 0 end,
      case when coalesce(tx.runs, 0) > 0 then round(tx.completion_tokens::numeric / tx.runs) else 0 end,
      coalesce(tx.reasoning_tokens, 0),
      coalesce(tx.models, array[]::text[]),
      greatest(tx.last_used, au.last_used)
    from tool_settings t
    left join text_usage  tx on tx.tool_slug = t.slug
    left join asset_usage au on au.tool_slug = t.slug
    left join runs        rn on rn.tool_slug = t.slug
    -- Preserved from 20260812130038: `hidden` rows stay out of the admin list.
    -- Utilities are NOT filtered here — they are the routes this migration
    -- exists to make controllable.
    where not t.hidden
    order by (coalesce(tx.cost, 0) + coalesce(au.cost, 0)) desc, t.slug;
end;
$$;
revoke execute on function admin_tools() from anon, public;
grant execute on function admin_tools() to authenticated;

-- ── 4. admin_update_tool(): accept the new fields ────────────────────────────
--
-- `model` uses coalesce like the existing fields — omitted means unchanged.
--
-- `effort` and `verbosity` deliberately do NOT, because they must be settable
-- back to NULL: switching a tool from gpt-5.6 to gpt-4o has to clear them, and
-- coalesce(null, effort) would silently keep the old value. Key-presence tests
-- distinguish "not supplied" from "supplied as null".
create or replace function admin_update_tool(p_slug text, payload jsonb)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare v_name text;
begin
  if not is_admin() then raise exception 'not authorized'; end if;

  update tool_settings set
    enabled    = coalesce((payload->>'enabled')::boolean, enabled),
    plans      = coalesce(
                   (select array_agg(value::text)
                      from jsonb_array_elements_text(payload->'plans')),
                   plans),
    model_note = coalesce(payload->>'model_note', model_note),
    notes      = coalesce(payload->>'notes', notes),
    model      = coalesce(payload->>'model', model),
    effort     = case when payload ? 'effort'    then payload->>'effort'    else effort    end,
    verbosity  = case when payload ? 'verbosity' then payload->>'verbosity' else verbosity end,
    updated_by = auth.uid(),
    updated_at = now()
  where slug = p_slug
  returning coalesce(display_name, slug) into v_name;

  if v_name is null then raise exception 'no such tool'; end if;

  perform admin_log('Updated tool', 'access', 'tool', p_slug, v_name, payload);
end;
$$;
revoke execute on function admin_update_tool(text, jsonb) from anon, public;
grant execute on function admin_update_tool(text, jsonb) to authenticated;
