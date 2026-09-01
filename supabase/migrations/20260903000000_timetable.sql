-- ── Timetable ────────────────────────────────────────────────────────────────
--
-- The sidebar has carried a Timetable item marked "Soon" since the V2 rebuild,
-- and Today's "This week" panel has shown an empty state saying the timetable
-- does not exist. This is the data behind both. It is also the answer to the
-- first of the handover's open decisions, timetable capture: a teacher tells
-- Jooma what they teach through a short setup, and edits it slot by slot after.
--
-- WHAT IS AND IS NOT IN THE DATABASE
--
-- Lessons are DATED, not recurring. Every row in timetable_lessons belongs to
-- one week and one week only, and "Maths" is stored once per week rather than
-- once. That looks like duplication and is not: after a teacher edits week 3,
-- week 3's Maths is genuinely no longer the same lesson as week 4's.
--
-- The alternative was a recurring skeleton joined to per-week overrides for the
-- topic and the attached resource. It was rejected on one case: a lesson
-- cancelled for a trip. A skeleton row cannot be deleted for a single week
-- without deleting it for every week, so cancelling needs a per-week tombstone
-- row, which is the override table wearing a hat. Dated rows make delete mean
-- delete, and every mutation stays local to one week.
--
-- The recurring pattern is still captured, in timetable_pattern.slots, but it
-- is a SEED and THE GRID NEVER READS IT. It is consulted once, when a week is
-- materialised and there is no earlier week to copy from. Read the week, render
-- the week: there is no join on the render path.
--
-- MATERIALISATION IS IDEMPOTENT BY CONSTRAINT, NOT BY CARE. The unique index on
-- (user_id, week_start, day, period) is what makes it safe. A double click, a
-- double mount under React StrictMode, or the same week open in two tabs cannot
-- produce two rows: the second insert conflicts and writes nothing. No lock, no
-- advisory lock, no security definer function.
--
-- A DELETED LESSON STAYS DELETED, which is why timetable_weeks exists. It is a
-- receipt, one row per week the teacher has opened, and its presence is the
-- sole answer to "has this week been built yet". Gating on "does this week have
-- any rows" instead would resurrect every lesson a teacher had just deleted the
-- moment they pressed Next and came back.
--
-- Past weeks that were never opened stay empty. Materialisation copies forward
-- only. Jooma did not exist for that teacher then, and inventing a history for
-- them would be a lie the grid tells confidently.
--
-- Period times are LABELS, not `time` values. '9:00' is what the grid prints in
-- its left column. Storing them as times would invite duration arithmetic,
-- overlap validation and timezone questions, none of which this feature has.
--
-- Like folders (20260902000000) and unlike user_badges (20260901000000), these
-- tables are browser-writable through RLS rather than going through a security
-- definer function. Same reasoning as folders, and it carries over cleanly: a
-- timetable is one teacher's own week, worth nothing to anyone else. There is
-- no privilege here to escalate to.

-- The days a lesson can fall on.
--
-- KEEP IN STEP WITH `TIMETABLE_DAYS` in app/lib/timetable.ts, which owns the
-- display names and the column order. This is only the whitelist that stops a
-- hand-rolled insert writing day = 'caturday' and leaving a lesson the grid
-- cannot place. Same arrangement as folder_colours() and known_badge_ids().
--
-- Monday to Friday only. The grid is five columns, and a weekend lesson would
-- have no column to render in.
create or replace function timetable_days()
returns text[]
language sql
immutable
set search_path = public
as $$
  select array['mon', 'tue', 'wed', 'thu', 'fri'];
$$;

revoke all on function timetable_days() from public, anon;
grant execute on function timetable_days() to authenticated;


-- ── The pattern ──────────────────────────────────────────────────────────────
--
-- One row per teacher, written by the setup wizard. Two jobs and no others: it
-- holds the period labels the grid's left column prints, and it holds the seed
-- the first week is built from.
--
-- Its absence is meaningful. No row means the wizard has not been run, which is
-- what the Timetable page checks to decide whether to show the wizard or the
-- grid. Skipping the wizard writes a row with empty slots, so "skipped" and
-- "not yet asked" stay distinguishable and a teacher is asked exactly once.
create table if not exists timetable_pattern (
  user_id    uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  -- Ordered period labels. Index n here is `period` n on a lesson row. Between
  -- one and ten: a day with no periods cannot render a grid, and a teacher with
  -- eleven is describing something this screen is not.
  periods    text[] not null default array['9:00', '11:00', '13:15', '14:45']
               check (array_length(periods, 1) between 1 and 10),
  -- The teacher's usual year group, copied onto each lesson as it is created
  -- rather than joined at read time. A teacher who moves to Year 5 in September
  -- should not silently rewrite the history of last term.
  year_group text check (year_group is null or length(btrim(year_group)) between 1 and 40),
  -- The recurring skeleton, as [{ day, period, subject }]. jsonb rather than a
  -- table because nothing ever queries inside it: it is read whole, written
  -- whole, and replaced whole when the wizard is run again.
  slots      jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table timetable_pattern enable row level security;

-- `(select auth.uid())` rather than a bare call: see 20260805002000, Postgres
-- otherwise re-evaluates it once per row.
create policy "own pattern read"
  on timetable_pattern for select using ((select auth.uid()) = user_id);

create policy "own pattern insert"
  on timetable_pattern for insert with check ((select auth.uid()) = user_id);

create policy "own pattern update"
  on timetable_pattern for update
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

create policy "own pattern delete"
  on timetable_pattern for delete using ((select auth.uid()) = user_id);

grant select, insert, update, delete on timetable_pattern to authenticated;


-- ── Visited weeks ────────────────────────────────────────────────────────────
--
-- A receipt, not a container. One row means "this teacher has opened this week,
-- and materialisation has already run for it". See the note at the top: this is
-- the whole reason an emptied week stays empty.
--
-- week_start is always a MONDAY, enforced. Every read, write and unique
-- constraint keys off it, and a week keyed from Sunday in one place and Monday
-- in another silently splits a single week into two that cannot see each other.
create table if not exists timetable_weeks (
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  week_start date not null check (extract(isodow from week_start) = 1),
  created_at timestamptz not null default now(),
  primary key (user_id, week_start)
);

alter table timetable_weeks enable row level security;

create policy "own weeks read"
  on timetable_weeks for select using ((select auth.uid()) = user_id);

create policy "own weeks insert"
  on timetable_weeks for insert with check ((select auth.uid()) = user_id);

create policy "own weeks update"
  on timetable_weeks for update
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

create policy "own weeks delete"
  on timetable_weeks for delete using ((select auth.uid()) = user_id);

grant select, insert, update, delete on timetable_weeks to authenticated;


-- ── Lessons ──────────────────────────────────────────────────────────────────
create table if not exists timetable_lessons (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade default auth.uid(),
  week_start  date not null check (extract(isodow from week_start) = 1),
  day         text not null check (day = any (timetable_days())),
  -- Zero-indexed into timetable_pattern.periods. Deliberately NOT constrained
  -- against that array's length: a teacher shortening their period list must not
  -- have the update fail because of lessons already sitting in the periods being
  -- removed. The client shows those lessons and offers to move them, which is a
  -- conversation rather than a constraint violation.
  period      int not null check (period between 0 and 9),
  subject     text not null check (length(btrim(subject)) between 1 and 40),
  -- The week's topic. Null is a real state, not a missing one: a lesson exists
  -- on the timetable before anybody has decided what it is about, and the grid
  -- shows the subject alone until then.
  topic       text check (topic is null or length(btrim(topic)) between 1 and 80),
  year_group  text check (year_group is null or length(btrim(year_group)) between 1 and 40),
  -- The attached resource. `on delete set null`, never cascade: deleting a
  -- resource from the Library must empty the chip on the lesson, not cancel the
  -- lesson itself. Same reasoning as folders.folder_id on tool_runs.
  --
  -- This reaches into tool_runs and needs no policy of its own. The existing
  -- "own runs read" select policy governs the embed, so a hand-edited
  -- resource_id pointing at somebody else's run renders an empty chip rather
  -- than leaking a title: the joined row is simply invisible.
  resource_id uuid references tool_runs (id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table timetable_lessons enable row level security;

-- The whole idempotency story, in one index. Materialisation inserts against
-- this with ignoreDuplicates, so running it twice is a no-op rather than a
-- doubled grid. It also enforces the thing the grid assumes structurally: one
-- lesson per cell.
create unique index if not exists timetable_lessons_slot_idx
  on timetable_lessons (user_id, week_start, day, period);

-- The read the grid makes, and the read Today makes: one teacher, one week.
create index if not exists timetable_lessons_week_idx
  on timetable_lessons (user_id, week_start);

create policy "own lessons read"
  on timetable_lessons for select using ((select auth.uid()) = user_id);

create policy "own lessons insert"
  on timetable_lessons for insert with check ((select auth.uid()) = user_id);

create policy "own lessons update"
  on timetable_lessons for update
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

create policy "own lessons delete"
  on timetable_lessons for delete using ((select auth.uid()) = user_id);

-- A policy without the grant is inert.
grant select, insert, update, delete on timetable_lessons to authenticated;
