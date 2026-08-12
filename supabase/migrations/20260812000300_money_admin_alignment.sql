-- Align the admin console's money section with what Jooma actually sells.
--
-- The catalogue is now three things: Free, Pro (£7.99/mo) and a repeatable
-- £1.50 AI credit top-up. This migration makes the schema say that, and adds
-- the pieces needed for a price change made in the console to reach Stripe.
--
-- Four changes:
--   1. plan_price_history — so a price change never orphans a subscriber.
--   2. topup_packs.stripe_price_id + a real row for the £1.50 credit top-up.
--   3. pricing_rules.not_implemented — stop showing switches that do nothing.
--   4. Retire the four seeded packs that have no purchase path.

-- ── 1. Price history ─────────────────────────────────────────────────────────
-- Stripe Price objects are immutable, so changing a price means creating a NEW
-- Price and repointing at it. Existing subscribers keep billing against the old
-- Price indefinitely — that is Stripe's behaviour, not a bug.
--
-- This is load-bearing for correctness: planForPriceId() resolves an incoming
-- subscription's price to one of our plans, and the webhook treats an
-- unrecognised price as "no subscription" and drops the user to Free. Without a
-- record of superseded prices, the first price change would silently downgrade
-- every existing Pro subscriber on their next subscription event.
create table if not exists plan_price_history (
  id              uuid primary key default gen_random_uuid(),
  plan_id         text not null references plan_config(plan_id) on delete cascade,
  stripe_price_id text not null unique,
  -- Nominal amount at the time it was set, for reporting only. The Price object
  -- in Stripe is the authority on what anyone is actually charged.
  price_gbp       numeric(10,2),
  interval        text not null default 'month' check (interval in ('month','year','one_time')),
  -- Null while this is the price new checkouts use; set when superseded.
  archived_at     timestamptz,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists plan_price_history_plan_idx
  on plan_price_history (plan_id, created_at desc);

alter table plan_price_history enable row level security;

-- Readable by anyone signed in: these are public Stripe identifiers (they
-- appear in any Checkout URL), not secrets. Writes are admin-only and go
-- through the API route so Stripe and the DB move together.
drop policy if exists "plan price history readable" on plan_price_history;
create policy "plan price history readable" on plan_price_history
  for select using (true);

drop policy if exists "admins write plan price history" on plan_price_history;
create policy "admins write plan price history" on plan_price_history
  for all using (is_admin()) with check (is_admin());

-- ── 2. Top-up packs carry their Stripe price ─────────────────────────────────
alter table topup_packs add column if not exists stripe_price_id text;

-- The £1.50 credit top-up is denominated in pence of AI spend, not in units of
-- a resource pool, so the original two-kind constraint could not express it.
alter table topup_packs drop constraint if exists topup_packs_kind_check;
alter table topup_packs add constraint topup_packs_kind_check
  check (kind in ('resource','ai_image','credit_gbp'));

-- topup_purchases already writes kind='credit_gbp' (widened in
-- 20260810000100_cost_ceiling.sql); keep the two tables in step.

-- ── 3. Rules that are not wired to anything ──────────────────────────────────
-- Every rule in this table was a toggle that flipped a boolean and changed no
-- behaviour anywhere in the codebase. Rather than quietly leave ten dead
-- switches in the admin UI, mark the unwired ones so the console can render
-- them disabled and say so.
alter table pricing_rules add column if not exists not_implemented boolean not null default false;

comment on column pricing_rules.not_implemented is
  'True when nothing in the codebase reads this rule. The admin UI renders these disabled rather than offering a switch that does nothing. Clear the flag in the same change that wires the rule up.';

-- Wired: topups_expire is enforced by grantTopUpCredit()'s expires_at, and
-- offer_topup_at_zero is read by the upgrade gate. Everything else is inert.
update pricing_rules
   set not_implemented = true
 where key not in ('topups_expire', 'offer_topup_at_zero');

update pricing_rules
   set not_implemented = false
 where key in ('topups_expire', 'offer_topup_at_zero');

-- topups_expire was seeded false, but grantTopUpCredit() has always set
-- expires_at to the end of the purchase month unconditionally. The database was
-- describing the opposite of the enforced behaviour; make it honest. Rolling
-- credit over is a product decision that needs the webhook changed too.
update pricing_rules
   set enabled = true, updated_at = now()
 where key = 'topups_expire' and enabled = false;

-- Rules that only make sense for plans we do not sell.
update pricing_rules
   set description = coalesce(description, '') || ' (School plan is not built yet.)'
 where key in ('school_onboarding_fee', 'school_self_topup')
   and description not like '%School plan is not built yet.%';

-- ── 4. One real pack, and retire the orphans ─────────────────────────────────
-- The four seeded packs (100/300 resources, 10/25 AI slideshows) have never had
-- a customer-facing purchase path: nothing in the app creates a Checkout session
-- for them. Deactivating rather than deleting keeps any historical purchase
-- rows resolvable.
update topup_packs
   set active = false
 where kind in ('resource', 'ai_image');

-- The thing actually on sale. stripe_price_id is left null here on purpose:
-- the value lives in STRIPE_PRICE_CREDIT_TOP_UP and differs per environment
-- (sandbox vs live), so it is backfilled at runtime by the price resolver
-- rather than hardcoded into a migration that runs in both.
insert into topup_packs (kind, name, price_gbp, unit, available_to, active, sort)
select 'credit_gbp', 'AI credit top-up', 1.50, 150, array['free','pro']::text[], true, 0
where not exists (select 1 from topup_packs where kind = 'credit_gbp');

comment on column topup_packs.unit is
  'Units of the pool this pack grants. For kind=credit_gbp this is PENCE of AI spend, matching allowance_grants.amount for that kind. For the other kinds it is a whole count of resources or slideshows.';
