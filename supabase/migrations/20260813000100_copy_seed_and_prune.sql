-- ── Copy blocks: seed in code, prune what nothing renders ────────────────────
-- Two problems, both of which made /admin/copy a page that lies.
--
-- 1. The rows only existed in staging. Someone inserted 14 copy blocks by hand;
--    no migration contains them. A fresh environment came up with an empty
--    table, /admin/copy rendered its empty state, and every surface fell back
--    to whatever string was hardcoded in the component. This makes the seed
--    reproducible.
--
-- 2. Five of the fourteen described product that no longer exists. A copy block
--    nothing reads is worse than no block at all: an admin edits it, publishes
--    it, sees "Published to jooma.ai", and nothing anywhere changes. That
--    teaches them to distrust the whole page. Better to not offer the row.
--
-- What goes, and why:
--
--   pricing.schools_cta  "Contact Sales". There is no Contact Sales button.
--                        Schools are sold through a mailto line at the foot of
--                        /pricing (app/pricing/page.tsx), because plan_config
--                        has school at status='draft' with 0 schools and 0
--                        seats — it is not a thing anyone can buy yet.
--
--   pricing.ai_images    "AI-generated slideshow images: {n} a month included".
--                        No per-plan AI image line is rendered on /pricing or
--                        anywhere else.
--
--   dash.res.low         "You have {n} resources left this month."
--   dash.res.out         "You have used this month's resources. Top up or wait
--                        until {date}." Both assume a monthly resource count.
--                        Pro is fair-use now — plan_config.monthly_resources is
--                        null for it — so there is no {n} to fill in and no UI
--                        that renders either string.
--
--   dash.ai.out          Unreachable. It was meant to feed UpgradeGate, but
--                        that reads `block.error ?? fallback` and the server
--                        always populates error (app/lib/generation-guard.ts,
--                        `error: q.message` in the shared gate body). The
--                        fallback branch cannot execute.
--
-- That leaves nine, every one of which drives something a teacher can see.

-- Seed. `on conflict (key) do nothing` per row, deliberately not the table-wide
-- `where not exists (select 1 from copy_blocks)` used by the 20260805 seeds:
-- that form skips the whole insert once the table has any row in it, so a key
-- added in a later migration would silently never land.
insert into copy_blocks (key, where_shown, value, live, version) values
  ('home.hero.eyebrow',  'Landing / hero', 'AI-Powered Lesson Creation', true, 1),
  ('home.hero.h1',       'Landing / hero', 'Create personalised lessons in minutes, not hours.', true, 1),
  ('home.hero.sub',      'Landing / hero', 'Jooma helps teachers generate personalised, curriculum-aligned lessons in minutes — reducing planning time while improving classroom engagement.', true, 1),
  ('home.hero.cta',      'Landing / hero', 'Get Started', true, 1),
  ('home.hero.reassure', 'Landing / hero', 'No card required · 5 free resources every month', true, 1),
  ('pricing.headline',   'Pricing',        'Simple pricing for smarter lesson planning', true, 1),
  ('pricing.sub',        'Pricing',        'Choose a plan that saves you time, reduces workload, and helps you create better lessons in seconds.', true, 1),
  ('dash.empty.title',   'Teacher dashboard', 'Nothing here yet', true, 1),
  ('dash.empty.body',    'Teacher dashboard', 'Pick a tool and make your first resource — it takes about a minute.', true, 1)
on conflict (key) do nothing;

-- Note there is no <br /> in home.hero.h1 or pricing.headline, though both
-- headings render across two lines today. The break is typographic, not
-- semantic — it balances the heading. Encoding it here would mean either an
-- admin's edit silently loses it, or we render copy through
-- dangerouslySetInnerHTML to honour it. The components use CSS text-balance
-- instead, which wraps any string at any length without markup in the data.

-- Versions first: copy_block_versions has no FK to copy_blocks, so orphan
-- history would otherwise survive the delete and reappear if the key came back.
delete from copy_block_versions where key in (
  'pricing.schools_cta', 'pricing.ai_images',
  'dash.res.low', 'dash.res.out', 'dash.ai.out'
);
delete from copy_blocks where key in (
  'pricing.schools_cta', 'pricing.ai_images',
  'dash.res.low', 'dash.res.out', 'dash.ai.out'
);

-- The hero reassurance line drifted: the database says "5 free resources", the
-- component says "5 free generations". They mean the same allowance, but the
-- product calls them resources everywhere else. Now that the component reads
-- this row, the database wins.
--
-- Guarded on the old value so a wording change made by hand between the seed
-- and this migration is not silently reverted.
update copy_blocks
   set value = 'No card required · 5 free resources every month'
 where key = 'home.hero.reassure'
   and value = 'No card required · 5 free generations every month';
