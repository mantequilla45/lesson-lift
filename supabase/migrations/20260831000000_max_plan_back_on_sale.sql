-- Max back on sale.
--
-- Max was withdrawn in 20260810000100_cost_ceiling.sql (status='retired', to
-- match plans.ts `retired: true`). It returns as the step up from Pro: 2,500
-- credits against Pro's 1,000, at £14.99 a month. The V2 landing page sells it
-- alongside Free, Pro and a Schools enquiry card.
--
-- The credit figures are not stored. They are derived in app/lib/plans.ts from
-- AI_SPEND_CEILING_PENCE (Pro 150p, Max 375p) at 0.15p per credit, so the
-- teacher-facing number can never drift from the ceiling actually enforced.
--
-- Checkout also needs STRIPE_PRICE_MAX_MONTHLY set, or a stripe_price_monthly
-- recorded below. Until one exists, priceIdFor('max') throws and the Max button
-- fails loudly rather than billing the wrong price.

update plan_config
   set status       = 'live',
       -- Restated so a row edited while Max was withdrawn lands back on the
       -- advertised price rather than whatever it was left at.
       price_monthly = 14.99,
       price_yearly  = 149.00,
       updated_at    = now()
 where plan_id = 'max';

-- Once the Stripe price exists, either set STRIPE_PRICE_MAX_MONTHLY in the
-- environment or record it here, which takes precedence:
--
--   update plan_config
--      set stripe_price_monthly = 'price_...', updated_at = now()
--    where plan_id = 'max';
--
-- Prefer doing it through the admin console, which also writes
-- plan_price_history. That history is what stops an existing subscriber being
-- downgraded to Free by the webhook the first time the price is changed.
