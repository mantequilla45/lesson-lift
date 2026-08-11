-- ── Billing: invoices, top-ups, promos, plan config ──────────────────────────
-- Invoices previously existed only inside Stripe, and the webhook handled no
-- invoice.* events at all — so there was no local record to render, no dunning
-- signal, and nothing to join a school's BACS invoice against.
--
-- Money is stored in GBP because that's what Jooma sells in and what every
-- figure in this console displays. (AI cost stays in USD in token_usage /
-- asset_cost, because that's what the model providers bill.)

-- ── Invoices ─────────────────────────────────────────────────────────────────
create table if not exists invoices (
  id                uuid primary key default gen_random_uuid(),
  -- Human reference. For Stripe-originated rows this is the Stripe number;
  -- for school BACS invoices it's ours (INV-2026-0001).
  reference         text not null,
  school_id         uuid references schools(id) on delete set null,
  user_id           uuid references auth.users(id) on delete set null,
  type              text not null check (type in ('school','card','topup')),
  amount_gbp        numeric(10,2) not null default 0,
  status            text not null default 'draft'
                      check (status in ('draft','sent','paid','overdue','failed','refunded','void')),
  due_at            date,
  paid_at           timestamptz,
  -- Free-text description of how it was paid: "BACS · 14 seats @ £4.25",
  -- "Visa ••4242 · Pro monthly".
  method            text,
  po_number         text,
  -- Stripe linkage. Unique so webhook retries upsert rather than duplicate.
  stripe_invoice_id text unique,
  stripe_charge_id  text,
  attempt_count     integer not null default 0,
  failure_reason    text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists invoices_status_idx on invoices (status, due_at);
create index if not exists invoices_school_idx on invoices (school_id);
create index if not exists invoices_user_idx   on invoices (user_id);

alter table invoices enable row level security;

drop policy if exists "admins manage invoices" on invoices;
create policy "admins manage invoices" on invoices
  for all using (is_admin()) with check (is_admin());

-- A teacher may see their own invoices; the webhook writes via service role,
-- which bypasses RLS entirely.
drop policy if exists "own invoices read" on invoices;
create policy "own invoices read" on invoices
  for select using (auth.uid() = user_id);

-- ── Top-up packs ─────────────────────────────────────────────────────────────
-- What a teacher can buy when they run out mid-month. Two pools: resources are
-- cheap, AI images are not, and they are priced very differently on purpose.
create table if not exists topup_packs (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('resource','ai_image')),
  name         text not null,
  price_gbp    numeric(10,2) not null,
  unit         integer not null check (unit > 0),
  -- Which plans may buy this pack.
  available_to text[] not null default array['free','pro','max']::text[],
  active       boolean not null default true,
  sort         integer not null default 0,
  created_at   timestamptz not null default now()
);

alter table topup_packs enable row level security;

drop policy if exists "topup packs readable" on topup_packs;
create policy "topup packs readable" on topup_packs
  for select using (active or is_admin());

drop policy if exists "admins write topup packs" on topup_packs;
create policy "admins write topup packs" on topup_packs
  for all using (is_admin()) with check (is_admin());

insert into topup_packs (kind, name, price_gbp, unit, available_to, sort)
select * from (values
  ('resource', '100 extra resources',      3.99, 100, array['free','pro','max']::text[], 1),
  ('resource', '300 extra resources',      8.99, 300, array['free','pro','max']::text[], 2),
  ('ai_image', '10 AI-image slideshows',   2.99,  10, array['pro','max']::text[],        3),
  ('ai_image', '25 AI-image slideshows',   5.99,  25, array['pro','max']::text[],        4)
) as v(kind, name, price_gbp, unit, available_to, sort)
where not exists (select 1 from topup_packs);

-- ── Top-up purchases ─────────────────────────────────────────────────────────
create table if not exists topup_purchases (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  pack_id                  uuid references topup_packs(id) on delete set null,
  kind                     text not null check (kind in ('resource','ai_image')),
  units                    integer not null,
  price_gbp                numeric(10,2) not null,
  stripe_payment_intent_id text unique,
  created_at               timestamptz not null default now()
);

create index if not exists topup_purchases_user_idx on topup_purchases (user_id, created_at desc);

alter table topup_purchases enable row level security;

drop policy if exists "own topups read" on topup_purchases;
create policy "own topups read" on topup_purchases
  for select using (auth.uid() = user_id or is_admin());

drop policy if exists "admins write topups" on topup_purchases;
create policy "admins write topups" on topup_purchases
  for all using (is_admin()) with check (is_admin());

-- ── Promo codes ──────────────────────────────────────────────────────────────
-- Mirrors a Stripe promotion code so campaign performance can be reported
-- alongside everything else. Stripe stays the source of truth for redemption.
create table if not exists promo_codes (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  offer           text not null,
  channel         text,
  redeemed        integer not null default 0,
  revenue_gbp     numeric(10,2) not null default 0,
  expires_at      date,
  status          text not null default 'draft' check (status in ('draft','live','expired')),
  stripe_coupon_id           text,
  stripe_promotion_code_id   text,
  created_at      timestamptz not null default now()
);

alter table promo_codes enable row level security;

drop policy if exists "admins manage promos" on promo_codes;
create policy "admins manage promos" on promo_codes
  for all using (is_admin()) with check (is_admin());

-- ── Plan configuration ───────────────────────────────────────────────────────
-- Makes the Plans page editable. app/lib/plans.ts stays the typed fallback and
-- the compile-time source of truth for gating logic; this row overrides the
-- presentational/allowance numbers at runtime so pricing can change without a
-- deploy.
create table if not exists plan_config (
  plan_id              text primary key check (plan_id in ('free','pro','max','school')),
  name                 text not null,
  audience             text not null default 'teacher' check (audience in ('teacher','school')),
  price_monthly        numeric(10,2),
  price_yearly         numeric(10,2),
  monthly_resources    integer,
  ai_image_slideshows  integer not null default 0,
  description          text,
  status               text not null default 'live' check (status in ('live','draft','retired')),
  stripe_price_monthly text,
  stripe_price_yearly  text,
  sort                 integer not null default 0,
  updated_by           uuid references auth.users(id) on delete set null,
  updated_at           timestamptz not null default now()
);

alter table plan_config enable row level security;

drop policy if exists "plan config readable" on plan_config;
create policy "plan config readable" on plan_config
  for select using (true);

drop policy if exists "admins write plan config" on plan_config;
create policy "admins write plan config" on plan_config
  for all using (is_admin()) with check (is_admin());

-- Seeded from app/lib/plans.ts. Free's resource cap is 5 to match the gate
-- actually enforced in generation-guard.ts, NOT the 10 quoted in the console
-- spec — the enforced value is the honest one to show.
insert into plan_config (
  plan_id, name, audience, price_monthly, price_yearly,
  monthly_resources, ai_image_slideshows, description, sort
)
select * from (values
  ('free',   'Free',   'teacher',  0.00,   0.00,     5,  0, '5 resources a month, watermarked',        1),
  ('pro',    'Pro',    'teacher',  7.99,  79.00,  null, 12, 'Everything, fair use. For one teacher.',  2),
  ('max',    'Max',    'teacher', 14.99, 149.00,  null, 25, 'Adds leadership, inspection and CPD tools', 3),
  ('school', 'School', 'school',   4.25,  51.00,   300,  3, 'Per seat, banded, invoiced annually',     4)
) as v(plan_id, name, audience, price_monthly, price_yearly,
       monthly_resources, ai_image_slideshows, description, sort)
where not exists (select 1 from plan_config);

-- ── Pricing rules ────────────────────────────────────────────────────────────
create table if not exists pricing_rules (
  key         text primary key,
  label       text not null,
  description text,
  enabled     boolean not null default true,
  sort        integer not null default 0,
  updated_by  uuid references auth.users(id) on delete set null,
  updated_at  timestamptz not null default now()
);

alter table pricing_rules enable row level security;

drop policy if exists "pricing rules readable" on pricing_rules;
create policy "pricing rules readable" on pricing_rules
  for select using (true);

drop policy if exists "admins write pricing rules" on pricing_rules;
create policy "admins write pricing rules" on pricing_rules
  for all using (is_admin()) with check (is_admin());

insert into pricing_rules (key, label, description, enabled, sort)
select * from (values
  ('annual_default', 'Show annual as the default option',
   'Annual users are worth roughly twice as much. Make it the pre-selected toggle.', true, 1),
  ('grandfather_price', 'Existing subscribers keep their price',
   'Price changes only apply to new sign-ups. Strongly recommended.', true, 2),
  ('free_plan_available', 'Free plan available',
   'Turning this off makes signup card-required.', true, 3),
  ('hide_counter', 'Hide the resource counter on paid plans',
   'Show it only above 80% used. A visible counter makes teachers generate less.', true, 4),
  ('school_onboarding_fee', 'One-off onboarding fee for schools',
   'GBP 395, waived on two-year deals. No recurring admin fee.', true, 5),
  ('topups_expire', 'Top-ups expire at the end of the month',
   'Off means they roll over — friendlier, but harder to forecast.', false, 6),
  ('offer_topup_at_zero', 'Offer a top-up when someone hits zero',
   'Shows in the tool, at the moment they are blocked.', true, 7),
  ('suggest_upgrade', 'Suggest an upgrade after two top-ups',
   'A Pro teacher buying two AI packs is cheaper on Max. Say so.', true, 8),
  ('offer_free_images', 'Offer free library images as the alternative',
   'When AI images run out, remind them library slideshows are unlimited.', true, 9),
  ('school_self_topup', 'School teachers can buy their own top-ups',
   'Off means they ask their school admin to move capacity instead.', false, 10)
) as v(key, label, description, enabled, sort)
where not exists (select 1 from pricing_rules);
