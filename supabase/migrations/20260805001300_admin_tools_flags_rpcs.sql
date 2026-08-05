-- ── Tools & safeguarding RPCs ────────────────────────────────────────────────

-- The Tools page: every configured tool joined onto its real measured cost and
-- run count for the current month. Cost comes from token_usage + asset_cost —
-- the same source as every other cost figure in the console.
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
    order by (coalesce(tx.cost, 0) + coalesce(au.cost, 0)) desc, t.slug;
end;
$$;
revoke execute on function admin_tools() from anon, public;
revoke execute on function admin_tools() from anon, public;
grant execute on function admin_tools() to authenticated;

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

-- Model routing, driven by what token_usage actually recorded rather than an
-- assumed model list. Shows where spend concentrates so cheaper routing can be
-- considered per model.
create or replace function admin_model_routing()
returns table (
  model        text,
  runs         bigint,
  total_tokens bigint,
  cost_usd     numeric,
  cost_per_run numeric,
  tools        bigint
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    select
      tu.model,
      count(*),
      sum(tu.prompt_tokens + tu.completion_tokens),
      sum(tu.cost_usd),
      sum(tu.cost_usd) / greatest(count(*), 1),
      count(distinct tu.tool_slug)
    from token_usage tu
    where tu.created_at >= date_trunc('month', now())
    group by tu.model
    order by 4 desc;
end;
$$;
revoke execute on function admin_model_routing() from anon, public;
grant execute on function admin_model_routing() to authenticated;

-- ── Safeguarding ─────────────────────────────────────────────────────────────
create or replace function admin_safeguarding_flags(p_status text default null)
returns table (
  id          uuid,
  user_id     uuid,
  teacher     text,
  email       text,
  tool_slug   text,
  reason      text,
  excerpt     text,
  severity    text,
  status      text,
  review_note text,
  reviewer    text,
  reviewed_at timestamptz,
  created_at  timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    select
      f.id, f.user_id,
      coalesce(nullif(trim(coalesce(p.first_name,'') || ' ' || coalesce(p.surname,'')), ''),
               u.email::text, '—'),
      u.email::text,
      f.tool_slug, f.reason, f.excerpt, f.severity, f.status, f.review_note,
      ru.email::text, f.reviewed_at, f.created_at
    from safeguarding_flags f
    left join auth.users u  on u.id = f.user_id
    left join profiles p    on p.id = f.user_id
    left join auth.users ru on ru.id = f.reviewed_by
    where p_status is null or p_status = '' or f.status = p_status
    order by
      case f.status when 'review' then 0 else 1 end,
      case f.severity when 'high' then 0 when 'medium' then 1 else 2 end,
      f.created_at desc;
end;
$$;
revoke execute on function admin_safeguarding_flags(text) from anon, public;
grant execute on function admin_safeguarding_flags(text) to authenticated;

create or replace function admin_safeguarding_summary()
returns table (
  flagged_30d      bigint,
  awaiting_review  bigint,
  confirmed        bigint,
  cleared          bigint,
  oldest_open      timestamptz,
  generations_30d  bigint
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    select
      (select count(*) from safeguarding_flags f
        where f.created_at >= now() - interval '30 days'),
      (select count(*) from safeguarding_flags f where f.status = 'review'),
      (select count(*) from safeguarding_flags f
        where f.status = 'confirmed' and f.created_at >= now() - interval '30 days'),
      (select count(*) from safeguarding_flags f
        where f.status = 'cleared' and f.created_at >= now() - interval '30 days'),
      (select min(f.created_at) from safeguarding_flags f where f.status = 'review'),
      (select count(*) from tool_runs r where r.created_at >= now() - interval '30 days');
end;
$$;
revoke execute on function admin_safeguarding_summary() from anon, public;
grant execute on function admin_safeguarding_summary() to authenticated;

create or replace function admin_review_flag(
  flag_id uuid, p_status text, p_note text default null
)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare v_label text; v_user uuid;
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  if p_status not in ('review','confirmed','cleared') then
    raise exception 'invalid status';
  end if;

  update safeguarding_flags
     set status = p_status,
         review_note = coalesce(p_note, review_note),
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = flag_id
  returning user_id, reason into v_user, v_label;

  if v_label is null then raise exception 'no such flag'; end if;

  perform admin_log(
    'Reviewed safeguarding flag — ' || p_status,
    'access', 'safeguarding_flag', flag_id::text, v_label,
    jsonb_build_object('status', p_status, 'user_id', v_user, 'note', p_note)
  );
end;
$$;
revoke execute on function admin_review_flag(uuid, text, text) from anon, public;
grant execute on function admin_review_flag(uuid, text, text) to authenticated;
