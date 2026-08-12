-- ── Canned replies: match the product we actually sell ───────────────────────
-- The seeds in 20260805001500_support.sql came from the console mockup, which
-- described a product that has since changed. Left alone, support would be
-- quoting prices and plans that do not exist to the teacher who is already
-- annoyed enough to have written in.
--
-- What was wrong:
--
--   out_of_resources    Promised "I've added 100 to your account". A free
--                       teacher gets 5 a month, so 100 is twenty months of
--                       allowance in one sentence, and the Grant modal defaults
--                       to 5. The reply now describes the grant that actually
--                       gets made.
--
--   ai_images_used      Offered "a pack of 10 for £2.99" and "Max includes 25 a
--                       month". Neither exists. topup_packs holds exactly one
--                       row — AI credit, £1.50 for 150 units — and Max is
--                       retired (plans.ts `retired: true`, plan_config
--                       status='retired'), with no Stripe price and no checkout
--                       path. AI images cannot be self-served up at all: the
--                       only route is an admin grant.
--
--   offer_annual        Removed. It was a retention script for a churn
--                       conversation, not an answer to a question.
--
--   invite_not_received Removed. It answered a question about school email
--                       filters that the invite flow no longer produces.
--
--   card_failed         Kept, minus the [link] placeholder — the composer now
--                       has a "Copy billing link" button that mints a real
--                       Stripe portal URL, so the reply says to paste it.
--
--   known_bug           Kept as written.

delete from canned_replies where key in ('offer_annual', 'invite_not_received');

-- Rewritten bodies. Updated in place rather than re-seeded so an admin's own
-- wording edits to known_bug are not clobbered.
update canned_replies
   set body = 'You''ve used this month''s resources. I''ve topped your account up so you''re not stuck — they''re there as soon as you refresh. Your allowance resets on the 1st.',
       sort = 1
 where key = 'out_of_resources';

update canned_replies
   set label = 'AI images used up',
       body = 'You''ve used your AI slideshow images for this month. Slideshows built from our free image library are still unlimited, and on a whiteboard most classes can''t tell the difference. If you need more of the AI ones before your allowance resets on the 1st, tell me roughly how many and I''ll add them to your account.',
       sort = 2
 where key = 'ai_images_used';

update canned_replies
   set body = 'Your card was declined by your bank rather than by us, which usually means a security check didn''t complete. I''ve put a secure link below to re-enter your card — it takes about 30 seconds and nothing else about your account changes.',
       sort = 3
 where key = 'card_failed';

update canned_replies set sort = 4 where key = 'known_bug';

-- New: the two questions support answers most often that had no snippet.
--
-- On the credit figure: topup_packs.unit for a credit pack is PENCE of model
-- spend (150 = £1.50), not a count of credits. At PENCE_PER_CREDIT = 0.15 that
-- is 1,000 credits — see PLAN_CREDITS in app/lib/plans.ts. Quoting "150
-- credits" would understate what they get by nearly 7x.
--
-- And never quote the pence figure to a teacher. plans.ts spells out why: "£1.50
-- of AI" next to a £7.99 charge reads as though they only got £1.50 of value,
-- which is wrong and unarguable once seen. Credits are the teacher-facing unit.
insert into canned_replies (key, label, body, sort)
select * from (values
  ('ai_credit_topup', 'AI credit top-up',
   'You can top up yourself from Billing in your account — £1.50 for 1,000 credits, which is the same again on top of your monthly allowance. It doesn''t change your subscription and won''t renew on its own. The credits are there as soon as the payment clears, and they run to the end of the month.', 5),
  ('free_plan_limits', 'What Free includes',
   'The free plan covers 1 resource a day and 5 a month, and exports carry a small Jooma watermark. Pro is £7.99 a month for unlimited resources under fair use, no watermark, Word and PowerPoint exports, and a saved library. You can move up or cancel whenever you like.', 6)
) as v(key, label, body, sort)
where not exists (select 1 from canned_replies c where c.key = v.key);
