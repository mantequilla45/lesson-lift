-- ── Fix: the first claim on an established account was always rejected ───────
--
-- claim_badges() capped a claim at 40 ids, on the reasoning that a claim is
-- normally a badge or two. That is true in the steady state and wrong about the
-- case that matters most: the FIRST claim on an account that already has
-- history.
--
-- A teacher who had been using Jooma for a month before badges existed
-- qualifies for fifty or more at once. The client evaluates its history, offers
-- all of them, and the whole array is rejected with
--
--   P0001: too many badges claimed at once
--
-- Nothing is awarded, and because the evaluation is the same on every load, it
-- fails identically forever. On the day badges ship that is every existing user,
-- not an edge case.
--
-- The length check was never the security control. known_badge_ids() rejects
-- ids that are not in the catalogue and badge_gate_ok() puts a floor under the
-- volume badges, both per id, against the teacher's own tool_runs. A client
-- claiming all hundred still only receives the ones it can prove. The bound
-- exists solely so an unbounded array cannot be unnested, so it belongs at the
-- size of the catalogue.
--
-- 20260901000000 carries the same change for a database built from scratch;
-- this migration is what moves one that already ran it.

create or replace function claim_badges(candidate_ids text[])
returns setof text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
  run_count int;
  distinct_tools int;
  distinct_days int;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if candidate_ids is null or array_length(candidate_ids, 1) is null then
    return;
  end if;

  -- The catalogue is 100 badges. Nothing can legitimately claim more.
  if array_length(candidate_ids, 1) > 100 then
    raise exception 'too many badges claimed at once';
  end if;

  -- One pass over tool_runs for every floor badge_gate_ok checks. distinct_days
  -- is a deliberate over-approximation of the streak: the exact rule (weekends
  -- skipped, one weekday forgiven, Europe/London) is not worth restating in SQL,
  -- but "you cannot have a 30 day streak with 12 active days" catches the case
  -- that matters.
  select count(*),
         count(distinct tool_slug),
         count(distinct (created_at at time zone 'Europe/London')::date)
    into run_count, distinct_tools, distinct_days
    from tool_runs
   where user_id = uid;

  return query
  insert into user_badges (user_id, badge_id)
  select uid, candidate
    from unnest(candidate_ids) as candidate
   where candidate = any (known_badge_ids())
     and badge_gate_ok(candidate, run_count, distinct_tools, distinct_days)
  on conflict (user_id, badge_id) do nothing
  returning badge_id;
end;
$$;

revoke all on function claim_badges(text[]) from public, anon;
grant execute on function claim_badges(text[]) to authenticated;
