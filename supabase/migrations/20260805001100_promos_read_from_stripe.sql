-- ── Promo codes now read live from Stripe ───────────────────────────────────
-- Stripe is what actually validates a code at checkout, so a code that existed
-- only in our database would be rejected the moment a teacher typed it. Keeping
-- a local copy meant two systems that could disagree, with the customer-facing
-- one always winning.
--
-- The admin page now lists stripe.promotionCodes directly, so these RPCs have
-- no caller. Dropping the functions removes the write path that could have
-- created a code here that Stripe has never heard of.
--
-- The `promo_codes` TABLE is deliberately left in place rather than dropped:
-- it holds no rows worth losing today, but dropping tables is destructive and
-- this one may yet be useful as a local cache for campaign attribution
-- (Stripe's promotion code metadata is the better home for that, and is what
-- the page reads today). Revisit once attribution requirements are settled.

drop function if exists admin_upsert_promo(jsonb);
drop function if exists admin_promo_codes();

comment on table promo_codes is
  'UNUSED as of 2026-08-05. Promo codes are read live from Stripe by the admin '
  'console (see app/admin/promos/page.tsx) because Stripe is what validates '
  'them at checkout. Retained pending a decision on local campaign attribution; '
  'do not write to this table without first resolving how it stays in step '
  'with Stripe.';
