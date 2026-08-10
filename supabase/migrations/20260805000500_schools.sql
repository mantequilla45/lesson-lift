-- ── Schools, trusts and seats ────────────────────────────────────────────────
-- The B2B side of the product, which had no schema at all: `profiles` was
-- simultaneously the user record, the billing record and the RBAC record, with
-- no school_id and no seat model. The `school` plan was therefore unreachable
-- via self-serve and unmodelled in data.
--
-- Key design decision: seats are ROWS, not a counter. `schools.seats` is the
-- contracted seat count (what the invoice is based on), and school_seats holds
-- one row per seat with its own lifecycle. That makes the seat-pool
-- visualisation a plain `group by status`, and makes "who has been invited but
-- never signed in" answerable without guessing.

-- ── Trusts ───────────────────────────────────────────────────────────────────
create table if not exists trusts (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

alter table trusts enable row level security;

drop policy if exists "admins manage trusts" on trusts;
create policy "admins manage trusts" on trusts
  for all using (is_admin()) with check (is_admin());

-- ── Schools ──────────────────────────────────────────────────────────────────
create table if not exists schools (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  -- DfE Unique Reference Number. Not unique-constrained: a school can be
  -- re-registered under a new trust and we'd rather accept the row than block
  -- onboarding on a data-entry collision.
  urn                text,
  town               text,
  phase              text check (phase in ('primary','secondary','all-through','special')),
  trust_id           uuid references trusts(id) on delete set null,

  -- Contracted seats. The seat ladder prices ALL seats at the band rate for
  -- this number — crossing a band re-prices every seat, not just the new ones.
  seats              integer not null default 10 check (seats >= 0),

  billing_type       text not null default 'invoice'
                       check (billing_type in ('invoice','card','direct_debit')),
  po_number          text,
  finance_email      text,
  payment_terms      integer not null default 30,
  invoice_schedule   text not null default 'annual'
                       check (invoice_schedule in ('annual','termly')),
  vat_registered     boolean not null default false,
  access_before_payment boolean not null default true,

  status             text not null default 'pending'
                       check (status in ('pending','onboarding','live','paused')),

  contract_start     date,
  renews_at          date,
  contract_months    integer not null default 12,
  onboarding_fee     numeric(10,2) not null default 395,

  dpa_signed_at      timestamptz,
  -- Anyone with this email domain can join without an individual invite, up to
  -- the seat count.
  domain_allowlist   text,

  -- Per-seat monthly pools. Defaults match the plan config but are stored per
  -- school so a negotiated deal doesn't need a code change.
  resources_per_seat integer not null default 300,
  ai_images_per_seat integer not null default 3,

  contact_name       text,
  contact_role       text,
  contact_email      text,
  contact_phone      text,

  notes              text,
  created_by         uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists schools_status_idx on schools (status);
create index if not exists schools_trust_idx  on schools (trust_id);

alter table schools enable row level security;

drop policy if exists "admins manage schools" on schools;
create policy "admins manage schools" on schools
  for all using (is_admin()) with check (is_admin());

-- A teacher on a school plan may read their own school (name, and nothing
-- sensitive is exposed by the app), so the dashboard can say who they're with.
drop policy if exists "members read own school" on schools;
create policy "members read own school" on schools
  for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.school_id = schools.id)
  );

-- ── Link teachers to schools ─────────────────────────────────────────────────
alter table profiles add column if not exists school_id uuid references schools(id) on delete set null;
create index if not exists profiles_school_idx on profiles (school_id);

-- ── Seats ────────────────────────────────────────────────────────────────────
-- One row per seat. `free` seats are bought-but-unallocated; `invited` has an
-- email but no accepted user yet; `assigned` is live; `dormant` is assigned but
-- unused for 30+ days (derived on read, stored so it can be snapshotted).
create table if not exists school_seats (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references schools(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete set null,
  status        text not null default 'free'
                  check (status in ('free','invited','assigned','dormant')),
  invited_email text,
  invited_at    timestamptz,
  accepted_at   timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists school_seats_school_idx on school_seats (school_id, status);
-- A user can occupy at most one seat, in one school.
create unique index if not exists school_seats_user_uniq
  on school_seats (user_id) where user_id is not null;

alter table school_seats enable row level security;

drop policy if exists "admins manage seats" on school_seats;
create policy "admins manage seats" on school_seats
  for all using (is_admin()) with check (is_admin());

drop policy if exists "own seat read" on school_seats;
create policy "own seat read" on school_seats
  for select using (auth.uid() = user_id);

-- ── School admins ────────────────────────────────────────────────────────────
-- The school manages its own seats; Jooma staff shouldn't have to do it for
-- them. These four booleans are the permission toggles from the onboarding
-- wizard.
create table if not exists school_admins (
  school_id          uuid not null references schools(id) on delete cascade,
  user_id            uuid not null references auth.users(id) on delete cascade,
  role               text not null default 'admin',
  can_invite         boolean not null default true,
  can_move_capacity  boolean not null default true,
  can_view_reports   boolean not null default true,
  -- Off by default: most schools need a PO before they can spend.
  can_buy_seats      boolean not null default false,
  created_at         timestamptz not null default now(),
  primary key (school_id, user_id)
);

alter table school_admins enable row level security;

drop policy if exists "admins manage school admins" on school_admins;
create policy "admins manage school admins" on school_admins
  for all using (is_admin()) with check (is_admin());

drop policy if exists "own school admin read" on school_admins;
create policy "own school admin read" on school_admins
  for select using (auth.uid() = user_id);

-- ── Onboarding checklist ─────────────────────────────────────────────────────
create table if not exists school_onboarding_tasks (
  school_id uuid not null references schools(id) on delete cascade,
  key       text not null,
  label     text not null,
  done      boolean not null default false,
  done_at   timestamptz,
  sort      integer not null default 0,
  primary key (school_id, key)
);

alter table school_onboarding_tasks enable row level security;

drop policy if exists "admins manage onboarding tasks" on school_onboarding_tasks;
create policy "admins manage onboarding tasks" on school_onboarding_tasks
  for all using (is_admin()) with check (is_admin());

-- ── Seat price ladder ────────────────────────────────────────────────────────
-- Reference data, editable from the Plans page. Declining per-seat rate with a
-- minimum of 10 seats.
create table if not exists seat_bands (
  id       uuid primary key default gen_random_uuid(),
  min_seats integer not null,
  max_seats integer not null,
  rate      numeric(10,2) not null,
  sort      integer not null default 0
);

alter table seat_bands enable row level security;

drop policy if exists "seat bands readable" on seat_bands;
create policy "seat bands readable" on seat_bands
  for select using (true);

drop policy if exists "admins write seat bands" on seat_bands;
create policy "admins write seat bands" on seat_bands
  for all using (is_admin()) with check (is_admin());

insert into seat_bands (min_seats, max_seats, rate, sort)
select * from (values
  (10,   19,   4.25, 1),
  (20,   49,   3.50, 2),
  (50,   99,   2.95, 3),
  (100,  9999, 2.50, 4)
) as v(min_seats, max_seats, rate, sort)
where not exists (select 1 from seat_bands);

-- The authoritative seat rate. The client mirrors this in app/lib/costs.ts for
-- live previews, but the server decides what a school actually pays.
create or replace function seat_rate(n integer)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select b.rate from seat_bands b
      where n >= b.min_seats and n <= b.max_seats
      order by b.sort limit 1),
    (select b.rate from seat_bands b order by b.sort limit 1)
  );
$$;
revoke execute on function seat_rate(integer) from anon, public;
grant execute on function seat_rate(integer) to authenticated;
