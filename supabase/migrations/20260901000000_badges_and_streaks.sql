-- ── Badge earning ────────────────────────────────────────────────────────────
--
-- The 100 badge catalogue has existed in app/lib/badges.ts since the V2 rebuild
-- and nothing could ever be earned, because there was nowhere to record it.
-- This is that record.
--
-- WHAT IS AND IS NOT IN THE DATABASE
--
-- There is no `badges` table. Names, descriptions, icons and level membership
-- stay in app/lib/badges.ts, which is the single source of truth. A table would
-- be a second copy that drifts, and the handover is explicit that the full 100
-- is still an open product decision, so every wording change would otherwise
-- become a migration against live data for no gain.
--
-- There is no streak table and no streak column either. A streak is "did this
-- teacher make something on this day", and tool_runs already answers that, with
-- an index on (user_id, tool_slug, created_at desc). A stored counter would
-- have to be incremented by the client, and a missed increment (tab closed,
-- offline, error swallowed) would permanently destroy a streak the teacher
-- actually earned, with no way to rebuild it because the evidence was never
-- written. Deriving it from tool_runs is reconstructible forever and self
-- heals. The rule itself (weekdays, weekends skipped, one weekday forgiven)
-- lives in app/lib/badgeCriteria.ts.
--
-- There is no `level` column. Level is floor(earned / per_level) + 1, capped at
-- 10. Storing it would let the stored value and the badge count disagree, and
-- there is no case where a teacher's level should differ from what their badges
-- say.
--
-- Nothing goes on `profiles`. See 20260811000400_lock_down_profile_self_update:
-- a user-writable column on that table was confirmed exploitable from the
-- browser with the anon key that ships in the client bundle. A separate table
-- with its own policies sidesteps the guard trigger entirely rather than
-- fighting it.

create table if not exists user_badges (
  user_id   uuid not null references auth.users (id) on delete cascade default auth.uid(),
  badge_id  text not null,
  earned_at timestamptz not null default now(),
  -- Composite primary key, so awarding is idempotent through `on conflict do
  -- nothing`. The claim function below runs on most page loads; without this,
  -- either every run would need a pre-read or earned_at would keep moving and
  -- "Earned 14 March" would silently become today.
  primary key (user_id, badge_id)
);

alter table user_badges enable row level security;

create index if not exists user_badges_user_idx on user_badges (user_id, earned_at desc);

-- `(select auth.uid())` rather than a bare call: see 20260805002000, Postgres
-- otherwise re-evaluates it once per row.
create policy "own badges read"
  on user_badges for select using ((select auth.uid()) = user_id);

-- SELECT only, and no insert policy anywhere in this file. Awarding goes
-- through claim_badges() below.
--
-- An insert policy here would reproduce the 20260811000400 hole exactly. One
-- line in a browser console grants the entire collection:
--
--   await supabase.from('user_badges')
--     .insert(ALL_BADGES.map(b => ({ badge_id: b.id })))
--
-- Badges are not money, but they are the whole progression system, and this
-- codebase has an established position that browser-writable state is not
-- acceptable.
grant select on user_badges to authenticated;


-- ── The id whitelist ─────────────────────────────────────────────────────────
--
-- The one unavoidable duplication of the catalogue, and it is deliberately a
-- flat list rather than any logic: without it a client could insert
-- badge_id = 'anything' and pollute the table with ids nothing will ever render.
--
-- KEEP IN STEP WITH app/lib/badges.ts. A badge added there but not here will
-- silently never award, with no error to notice. There is a pointer comment at
-- the top of that file saying the same thing from the other side.
create or replace function known_badge_ids()
returns text[]
language sql
immutable
set search_path = public
as $$
  select array[
    'first-resource', 'first-slides', 'first-worksheet', 'first-plan',
    'first-edit', 'first-save', 'first-mo', 'first-export',
    'profile-complete', 'first-week', 'three-tools', 'five-tools',
    'two-subjects', 'two-year-groups', 'assessment-first', 'send-first',
    'comms-first', 'reading-first', 'quiz-first', 'cover-first',
    'ten-resources', 'streak-3', 'streak-7', 'monday-morning',
    'early-bird', 'folder-five', 'refined', 'reused',
    'differentiated', 'ten-hours', 'twenty-five', 'all-categories',
    'long-deck', 'reading-ages', 'knowledge-organiser', 'modelled',
    'retrieval', 'homework-set', 'marking-saved', 'twenty-hours',
    'fifty-made', 'streak-30', 'whole-unit', 'medium-term',
    'eyfs', 'phonics', 'intervention', 'one-page',
    'behaviour-plan', 'fifty-hours', 'first-share', 'five-shares',
    'first-invite', 'three-invites', 'received', 'department',
    'newsletter', 'assembly', 'parents', 'cpd',
    'hundred', 'policy', 'sip', 'learning-walk',
    'observation', 'performance', 'meeting', 'inspection',
    'pupil-premium', 'risk-assessment', 'all-tools', 'streak-100',
    'term-planned', 'hundred-hours', 'every-year', 'ect-support',
    'exam-ready', 'reports-done', 'smart-targets', 'sensory',
    'two-hundred', 'full-year', 'every-half-term', 'two-hundred-hours',
    'library-fifty', 'organised', 'mo-regular', 'refined-often',
    'shared-twenty', 'mentor', 'five-hundred', 'two-years',
    'five-hundred-hours', 'every-category-deep', 'whole-school', 'ten-invites',
    'hundred-shares', 'never-missed', 'all-hundred', 'legend'
  ];
$$;


-- ── Server-side floors for the headline badges ───────────────────────────────
--
-- Criteria are evaluated in TypeScript (app/lib/badgeCriteria.ts), because a
-- hundred predicates over subjects, year groups, reading ages and streak shape
-- belong somewhere readable and testable, and because reimplementing them here
-- would be the second copy of the catalogue this design exists to avoid.
--
-- This is not that reimplementation. It is a floor under the badges a cheater
-- would most want, checked against rows the client cannot fake: "you made a
-- hundred resources" requires a hundred tool_runs rows, and those cost real
-- credits to create, so forging them is self defeating.
--
-- The qualitative badges (refined, differentiated, modelled) stay client
-- trusted. Somebody determined can award themselves "Second draft". Nobody
-- cares, and the row count gating the impressive ones is real.
create or replace function badge_gate_ok(
  id text,
  run_count int,
  distinct_tools int,
  distinct_days int
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select case id
    when 'ten-resources'  then run_count >= 10
    when 'twenty-five'    then run_count >= 25
    when 'fifty-made'     then run_count >= 50
    when 'hundred'        then run_count >= 100
    when 'two-hundred'    then run_count >= 200
    when 'five-hundred'   then run_count >= 500
    when 'library-fifty'  then run_count >= 50
    when 'three-tools'    then distinct_tools >= 3
    when 'five-tools'     then distinct_tools >= 5
    when 'all-tools'      then distinct_tools >= 35
    when 'streak-3'       then distinct_days >= 3
    when 'streak-7'       then distinct_days >= 7
    when 'streak-30'      then distinct_days >= 30
    when 'streak-100'     then distinct_days >= 100
    -- Anything not named above has no cheap server-side proxy and passes.
    else true
  end;
$$;


-- ── Claiming ─────────────────────────────────────────────────────────────────
--
-- The client evaluates the catalogue against its own history and sends the ids
-- it believes it has earned. This grants the ones that are real, and returns
-- only the ids it actually inserted, so the UI can celebrate exactly what is
-- new and say nothing on every subsequent visit.
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

  -- Bounded by the size of the catalogue, not by what a "normal" claim looks
  -- like.
  --
  -- This was 40, on the reasoning that a claim is usually a badge or two. That
  -- was wrong about the case that matters most: the FIRST claim on an account
  -- with history. A teacher who had been using Jooma for a month before badges
  -- existed qualifies for fifty or more at once, so every load claimed the lot,
  -- got rejected wholesale, and awarded nothing, forever. That is every
  -- existing user on the day this ships, not an edge case.
  --
  -- The length check was never the security control anyway. known_badge_ids()
  -- and badge_gate_ok() validate every id individually against the teacher's
  -- own tool_runs, so a client claiming all hundred still only receives the
  -- ones it can prove. This just stops an unbounded array being unnested.
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

revoke all on function known_badge_ids() from public, anon;
grant execute on function known_badge_ids() to authenticated;

revoke all on function badge_gate_ok(text, int, int, int) from public, anon;
grant execute on function badge_gate_ok(text, int, int, int) to authenticated;
