-- ── Tool settings & safeguarding flags ───────────────────────────────────────
-- The tool registry is a hardcoded array in app/lib/tools.ts with no plan
-- gating and no on/off switch, and its slug list is duplicated three times
-- (TOOLS[].href, TOOL_MINUTES_SAVED, GENERATION_PATHS) with nothing tying them
-- together. This table gives every tool a row so availability and plan access
-- can change without a deploy.
--
-- tools.ts stays the source of truth for a tool's *identity* — its name,
-- description, icon and route. This table holds only what an admin should be
-- able to change at runtime.

create table if not exists tool_settings (
  slug         text primary key,
  display_name text,
  enabled      boolean not null default true,
  -- Which plans may run this tool. Empty array = nobody (effectively off).
  plans        text[] not null default array['free','pro','max','school']::text[],
  -- Free-text note about model routing, e.g. 'Candidate for gpt-4o-mini'.
  -- Actual routing lives in the tool's own API route; this records intent and
  -- is what the Tools page surfaces for review.
  model_note   text,
  notes        text,
  updated_by   uuid references auth.users(id) on delete set null,
  updated_at   timestamptz not null default now()
);

alter table tool_settings enable row level security;

-- Readable by any signed-in user: the teacher-facing tool list needs to know
-- what's switched off and what their plan can reach.
drop policy if exists "tool settings readable" on tool_settings;
create policy "tool settings readable" on tool_settings
  for select using (auth.uid() is not null);

drop policy if exists "admins write tool settings" on tool_settings;
create policy "admins write tool settings" on tool_settings
  for all using (is_admin()) with check (is_admin());

-- ── Safeguarding flags ───────────────────────────────────────────────────────
-- Generations the content filter caught. UK schools ask how this is handled
-- before they sign, so it needs to be a real record with a review trail, not a
-- log line.
create table if not exists safeguarding_flags (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  tool_slug   text,
  tool_run_id uuid references tool_runs(id) on delete set null,
  reason      text not null,
  -- A short excerpt only, never the whole generation: enough for a reviewer to
  -- judge, not a second copy of potentially sensitive content.
  excerpt     text,
  severity    text not null default 'low' check (severity in ('low','medium','high')),
  status      text not null default 'review' check (status in ('review','confirmed','cleared')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at  timestamptz not null default now()
);

create index if not exists safeguarding_flags_status_idx
  on safeguarding_flags (status, created_at desc);
create index if not exists safeguarding_flags_user_idx
  on safeguarding_flags (user_id, created_at desc);

alter table safeguarding_flags enable row level security;

-- Admins only, in both directions. A teacher must not be able to enumerate
-- what tripped the filter — that turns the filter into a test harness.
drop policy if exists "admins manage flags" on safeguarding_flags;
create policy "admins manage flags" on safeguarding_flags
  for all using (is_admin()) with check (is_admin());

-- ── Seed tool_settings from the code registry ────────────────────────────────
-- Slugs are derived from TOOLS[].href in app/lib/tools.ts. Seeded permissively
-- (all plans, enabled) so this migration changes no behaviour on its own —
-- gating becomes real only when an admin narrows a row.
--
-- Note `lesson-slideshow` is included: the route exists at app/tools/
-- lesson-slideshow and can record runs, but it is NOT listed in the TOOLS
-- array, so it is invisible in the teacher-facing tool grid. That drift is
-- exactly what this table exists to make visible — the Tools page shows it,
-- flagged as unlisted, rather than letting it stay a silent orphan.
insert into tool_settings (slug, display_name, plans)
select * from (values
  ('comprehension-generator',  'Comprehension Generator',   array['free','pro','max','school']::text[]),
  ('lesson-planner',           'Lesson Planner',            array['free','pro','max','school']::text[]),
  ('worksheet-generator',      'Worksheet Generator',       array['free','pro','max','school']::text[]),
  ('cover-lesson',             'Cover Lesson Generator',    array['free','pro','max','school']::text[]),
  ('topic-overview',           'Topic Overview',            array['free','pro','max','school']::text[]),
  ('quiz-generator',           'Quiz Generator',            array['free','pro','max','school']::text[]),
  ('homework-generator',       'Homework Generator',        array['free','pro','max','school']::text[]),
  ('letter-writer',            'Letter Writer',             array['free','pro','max','school']::text[]),
  ('phonics-support',          'Phonics Support',           array['free','pro','max','school']::text[]),
  ('report-writer',            'Report Writer',             array['free','pro','max','school']::text[]),
  ('model-text-generator',     'Model Text Generator',      array['free','pro','max','school']::text[]),
  ('model-answer-generator',   'Model Answer Generator',    array['free','pro','max','school']::text[]),
  ('exam-question-generator',  'Exam Question Generator',   array['free','pro','max','school']::text[]),
  ('medium-term-planner',      'Medium Term Planner',       array['free','pro','max','school']::text[]),
  ('smart-targets',            'SMART Targets',             array['free','pro','max','school']::text[]),
  ('newsletter-writer',        'Newsletter Writer',         array['free','pro','max','school']::text[]),
  ('one-page-profile',         'One Page Profile',          array['free','pro','max','school']::text[]),
  ('targeted-intervention',    'Targeted Intervention',     array['free','pro','max','school']::text[]),
  ('behaviour-support-plan',   'Behaviour Support Plan',    array['free','pro','max','school']::text[]),
  ('sensory-activities',       'Sensory Activities',        array['free','pro','max','school']::text[]),
  ('risk-assessment',          'Risk Assessment',           array['free','pro','max','school']::text[]),
  ('eyfs-planner',             'EYFS Planner',              array['free','pro','max','school']::text[]),
  ('eyfs-action-plan',         'EYFS Action Plan',          array['free','pro','max','school']::text[]),
  ('assembly-planner',         'Assembly Planner',          array['free','pro','max','school']::text[]),
  ('meeting-planner',          'Meeting Planner',           array['free','pro','max','school']::text[]),
  ('policy-generator',         'Policy Generator',          array['free','pro','max','school']::text[]),
  ('school-improvement-plan',  'School Improvement Plan',   array['free','pro','max','school']::text[]),
  ('inspection-prep',          'Inspection Prep',           array['free','pro','max','school']::text[]),
  ('learning-walk-report',     'Learning Walk Report',      array['free','pro','max','school']::text[]),
  ('lesson-observation-report','Lesson Observation Report', array['free','pro','max','school']::text[]),
  ('performance-management',   'Performance Management',    array['free','pro','max','school']::text[]),
  ('pupil-premium-planner',    'Pupil Premium Planner',     array['free','pro','max','school']::text[]),
  ('ect-report-writer',        'ECT Report Writer',         array['free','pro','max','school']::text[]),
  ('cpd-slideshow',            'CPD Slideshow',             array['free','pro','max','school']::text[]),
  ('lesson-slideshow',         'Lesson Slideshow',          array['free','pro','max','school']::text[]),
  ('slideshow',                'Slideshow Generator',       array['free','pro','max','school']::text[])
) as v(slug, display_name, plans)
where not exists (select 1 from tool_settings);
