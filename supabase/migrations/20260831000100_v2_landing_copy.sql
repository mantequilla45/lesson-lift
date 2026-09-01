-- V2 landing copy, and two language rules.
--
-- The hero strings are editable in /admin/copy, so the database wins over the
-- DEFAULTS in app/lib/copy.ts at runtime. Rewriting the constants alone would
-- have left the live page still serving 'AI-Powered Lesson Creation'.
--
-- Two rules from the brand bible apply to every string below:
--
--   No "AI" anywhere a teacher can see. Not in tool names, buttons, empty
--   states or marketing. It is allowed only in the terms, the privacy policy
--   and school procurement documents. 'AI-Powered Lesson Creation' was the
--   first thing on the page.
--
--   No em dashes. Use a full stop, colon or comma. Both hero.sub and
--   dash.empty.body carried one.
--
-- Every update is guarded on the exact previous value, so a wording change made
-- by hand in the admin console since the seed is left alone rather than being
-- silently reverted. An admin who has already edited these keeps their edit.

update copy_blocks
   set value = 'Built for the UK curriculum', updated_at = now()
 where key = 'home.hero.eyebrow'
   and value = 'AI-Powered Lesson Creation';

update copy_blocks
   set value = 'Type a topic. Walk out with the lesson.', updated_at = now()
 where key = 'home.hero.h1'
   and value = 'Create personalised lessons in minutes, not hours.';

update copy_blocks
   set value = 'Jooma turns one line into the slides, the worksheet and the comprehension, matched to your year group. Try it on this page. No sign up, no card.',
       updated_at = now()
 where key = 'home.hero.sub'
   and value = 'Jooma helps teachers generate personalised, curriculum-aligned lessons in minutes — reducing planning time while improving classroom engagement.';

update copy_blocks
   set value = 'Start free', updated_at = now()
 where key = 'home.hero.cta'
   and value = 'Get Started';

-- Free is 1 generation a day and 5 a month. The V2 prototype promised "one
-- hundred credits a month", which is not what a signup gets, so the page says
-- what the product actually does.
update copy_blocks
   set value = 'Five free resources a month. No card needed.', updated_at = now()
 where key = 'home.hero.reassure'
   and value = 'No card required · 5 free resources every month';

update copy_blocks
   set value = 'Start free. Upgrade when it has already saved you a Sunday.',
       updated_at = now()
 where key = 'pricing.headline'
   and value = 'Simple pricing for smarter lesson planning';

update copy_blocks
   set value = 'Pick a tool and make your first resource. It takes about a minute.',
       updated_at = now()
 where key = 'dash.empty.body'
   and value = 'Pick a tool and make your first resource — it takes about a minute.';
