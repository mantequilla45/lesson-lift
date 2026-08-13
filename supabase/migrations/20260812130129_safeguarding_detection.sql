-- ── Safeguarding: give the flags table a producer ────────────────────────────
--
-- safeguarding_flags, its three admin RPCs and the whole review UI have existed
-- since 20260805001200/1300. Nothing has ever inserted a row. There was no
-- detector anywhere in the codebase, so the page was structurally guaranteed to
-- be empty, every statistic on it read 0, and the empty state said so.
--
-- This migration adds the three database pieces the detector needs. The
-- detection itself is app/lib/safeguarding.ts, called from streamChat().
--
-- WHAT IS BEING DETECTED, AND WHY IT IS THE INPUT.
-- Jooma is used by teachers in UK schools. The realistic safeguarding risk is
-- not a teacher being abusive to a chatbot — it is a teacher, in good faith,
-- pasting identifiable pupil safeguarding content into a prompt to get help
-- writing it up: a disclosure of abuse, a self-harm concern, a named child with
-- sensitive detail. That content should not sit unnoticed in an OpenAI request
-- body, and the school needs to know it was handled. So the detector reads what
-- the teacher TYPED, not what the model produced.
--
-- It never blocks and never delays a generation. This is a review trail, so
-- that when a school asks how you handle a teacher pasting pupil information
-- into an AI tool, the answer is a page with names on it rather than a shrug.

-- ── 1. run_id: the only usable link back to the generation ───────────────────
--
-- safeguarding_flags.tool_run_id is a real FK to tool_runs(id), and it cannot
-- be filled at detection time. tool_runs rows are written by the BROWSER after
-- the stream finishes (app/lib/toolRuns.ts), so at the moment the server can
-- see the prompt there is no tool_runs row to point at — and there may never be
-- one, if the teacher closes the tab.
--
-- run_id is the correlation id introduced for exactly this shape of problem
-- (20260811000800), and made unique on tool_runs by 20260811000900. Flagging
-- against it links a flag to its generation whether or not the history row was
-- ever saved, and lets the admin RPC resolve tool_runs.id by join when it
-- exists. tool_run_id is kept so a flag can still be tied to a run later.
alter table safeguarding_flags add column if not exists run_id uuid;

create index if not exists safeguarding_flags_run_id_idx
  on safeguarding_flags (run_id) where run_id is not null;

comment on column safeguarding_flags.run_id is
  'Correlates a flag with the generation that produced it. Used instead of tool_run_id because tool_runs is written client-side after the stream ends, long after detection.';

-- ── 2. The insert path ───────────────────────────────────────────────────────
--
-- safeguarding_flags is admin-only in BOTH directions on purpose (see
-- 20260805001200): a teacher who can read the table can binary-search the
-- detector and learn precisely what phrasing evades it, which turns the filter
-- into a test harness. But something has to write a row, and the detector runs
-- as the generating user inside a streaming response.
--
-- This is that path, and it is deliberately narrow:
--   * insert only — no select, no update, no delete
--   * always about auth.uid() — the caller cannot file a flag against anyone else
--   * status forced to 'review' — the caller cannot pre-clear their own flag
--   * returns void — the caller learns nothing, not even an id
--
-- WHO ACTUALLY USES THIS TODAY: not streamChat.
-- The detector runs in the stream's `finally`, after the response has been
-- handed off, where the request's cookies are gone — so auth.uid() would be
-- null there and this function would raise 'not authenticated', losing exactly
-- the flags that matter. That caller writes with the service role and an id
-- captured while the request was live, the same pattern recordUsage() uses and
-- for the same reason.
--
-- This RPC is still the right path for any caller that runs inside a live
-- request (a non-streaming route, or a future client-side check), and it is
-- what keeps the excerpt cap below enforceable for those callers rather than
-- being a convention in TypeScript that the next route can forget. It is
-- deliberately kept rather than deferred: the alternative is that the first
-- such caller reaches for the service-role key instead.
create or replace function record_safeguarding_flag(
  p_tool_slug text,
  p_reason    text,
  p_excerpt   text,
  p_severity  text,
  p_run_id    uuid default null
)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_severity not in ('low','medium','high') then
    raise exception 'invalid severity';
  end if;

  insert into safeguarding_flags
    (user_id, tool_slug, reason, excerpt, severity, status, run_id)
  values (
    v_uid,
    p_tool_slug,
    p_reason,
    -- Hard cap the excerpt in the DATABASE, not just in the caller. The premise
    -- of this table is that it holds just enough for a human to judge and never
    -- a second copy of sensitive pupil content. A caller that forgets to
    -- truncate must not be able to defeat that.
    left(coalesce(p_excerpt, ''), 300),
    p_severity,
    'review',
    p_run_id
  );
end;
$$;
revoke execute on function record_safeguarding_flag(text, text, text, text, uuid) from anon, public;
grant execute on function record_safeguarding_flag(text, text, text, text, uuid) to authenticated;

-- ── 3. Let a reviewer open the generation ────────────────────────────────────
--
-- The RPC previously returned neither tool_run_id nor anything else that could
-- lead a reviewer to what was actually generated — they could see that a flag
-- existed and not what caused it. It now resolves the run through run_id and
-- returns its id and title, so the review modal can link to it (and say so
-- plainly when the teacher never saved the run).
--
-- Dropped first: the return type gains three columns.
drop function if exists admin_safeguarding_flags(text);

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
  created_at  timestamptz,
  run_id      uuid,
  tool_run_id uuid,
  run_title   text
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
      ru.email::text, f.reviewed_at, f.created_at,
      f.run_id,
      -- Prefer the direct FK if one was ever set; otherwise resolve through the
      -- correlation id. Null when the teacher never saved the generation, which
      -- the UI reports rather than showing an empty field.
      coalesce(f.tool_run_id, tr.id),
      tr.title
    from safeguarding_flags f
    left join auth.users u  on u.id = f.user_id
    left join profiles p    on p.id = f.user_id
    left join auth.users ru on ru.id = f.reviewed_by
    left join tool_runs tr  on tr.run_id = f.run_id
    where p_status is null or p_status = '' or f.status = p_status
    order by
      case f.status when 'review' then 0 else 1 end,
      case f.severity when 'high' then 0 when 'medium' then 1 else 2 end,
      f.created_at desc;
end;
$$;
revoke execute on function admin_safeguarding_flags(text) from anon, public;
grant execute on function admin_safeguarding_flags(text) to authenticated;
