-- Rename the two assistant badges from Mo to Jo.
--
-- The assistant is now called Jo everywhere a teacher can see it, and its two
-- badge ids carried the old name: 'first-mo' and 'mo-regular'. Those ids are
-- persisted in user_badges and whitelisted in known_badge_ids(), so renaming
-- them in app/lib/badges.ts alone would have stranded every teacher who had
-- already earned one: the catalogue would look for 'first-jo', the row would
-- say 'first-mo', and the badge would silently vanish from their profile.
--
-- Three things have to move together, and this migration is two of them. The
-- third is app/lib/badges.ts and app/lib/badgeCriteria.ts, already changed in
-- the same commit.

-- ── The awarded rows ─────────────────────────────────────────────────────────
--
-- badge_id is half the composite primary key (user_id, badge_id), so an update
-- could in principle collide. It cannot here: 'first-jo' did not exist before
-- this migration, so no teacher can hold both the old id and the new one. There
-- is no foreign key and no column-level check constraint on badge_id either;
-- the whitelist below is enforced inside award_badges(), not by the table.
update user_badges set badge_id = 'first-jo'  where badge_id = 'first-mo';
update user_badges set badge_id = 'jo-regular' where badge_id = 'mo-regular';


-- ── The id whitelist ─────────────────────────────────────────────────────────
--
-- Restated in full rather than patched, because the list is a single flat
-- `select array[...]` with no seam to edit. Only the two ids differ from
-- 20260901000000_badges_and_streaks.sql; every other id, the ordering, the
-- `immutable` marker and the search_path are unchanged.
--
-- KEEP IN STEP WITH app/lib/badges.ts.
create or replace function known_badge_ids()
returns text[]
language sql
immutable
set search_path = public
as $$
  select array[
    'first-resource', 'first-slides', 'first-worksheet', 'first-plan',
    'first-edit', 'first-save', 'first-jo', 'first-export',
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
    'library-fifty', 'organised', 'jo-regular', 'refined-often',
    'shared-twenty', 'mentor', 'five-hundred', 'two-years',
    'five-hundred-hours', 'every-category-deep', 'whole-school', 'ten-invites',
    'hundred-shares', 'never-missed', 'all-hundred', 'legend'
  ];
$$;

-- `create or replace` keeps the existing grants on an existing function, so the
-- revoke/grant pair from the original migration is deliberately not repeated.
