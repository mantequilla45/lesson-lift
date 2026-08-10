-- ── Content, announcements, email templates, roles, settings ─────────────────
-- The last of the console's domains. The significant change here is roles:
-- RBAC has been a single `profiles.is_admin` boolean, which cannot express
-- "support can grant resources but not issue refunds".

-- ── Website & app copy ───────────────────────────────────────────────────────
-- Every string on the marketing site and in the teacher dashboard, editable
-- without a deploy. Edits are drafts until published, so nothing goes live by
-- accident, and every published version is retained for rollback.
create table if not exists copy_blocks (
  key         text primary key,
  where_shown text not null,
  -- What is live right now. Null until first published.
  value       text,
  -- The unpublished edit, if any. Null when there is no pending change.
  draft       text,
  version     integer not null default 1,
  live        boolean not null default false,
  updated_by  uuid references auth.users(id) on delete set null,
  updated_at  timestamptz not null default now()
);

alter table copy_blocks enable row level security;

-- Published copy is world-readable: the marketing site renders it for signed-out
-- visitors. Drafts are NOT protected by this policy — see the note on
-- public_copy below.
drop policy if exists "copy readable" on copy_blocks;
create policy "copy readable" on copy_blocks
  for select using (true);

drop policy if exists "admins write copy" on copy_blocks;
create policy "admins write copy" on copy_blocks
  for all using (is_admin()) with check (is_admin());

-- Anonymous readers must see published values only. RLS is row-level, not
-- column-level, so a view is what keeps unpublished drafts out of the public
-- API surface. Read this, not copy_blocks, from anything teacher-facing.
create or replace view public_copy
with (security_invoker = true)
as select key, where_shown, value, version
   from copy_blocks
   where live and value is not null;

grant select on public_copy to anon, authenticated;

create table if not exists copy_block_versions (
  id           uuid primary key default gen_random_uuid(),
  key          text not null references copy_blocks(key) on delete cascade,
  version      integer not null,
  value        text not null,
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz not null default now()
);

create index if not exists copy_block_versions_key_idx
  on copy_block_versions (key, version desc);

alter table copy_block_versions enable row level security;

drop policy if exists "admins read copy history" on copy_block_versions;
create policy "admins read copy history" on copy_block_versions
  for select using (is_admin());

-- ── Announcements ────────────────────────────────────────────────────────────
create table if not exists announcements (
  id              uuid primary key default gen_random_uuid(),
  message         text not null,
  type            text not null default 'info' check (type in ('info','warning','maintenance')),
  audience        text not null default 'everyone'
                    check (audience in ('everyone','free','paying','school','one_school')),
  school_id       uuid references schools(id) on delete cascade,
  dismissible     boolean not null default true,
  starts_at       timestamptz not null default now(),
  ends_at         timestamptz,
  live            boolean not null default false,
  seen_count      integer not null default 0,
  dismissed_count integer not null default 0,
  click_count     integer not null default 0,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

alter table announcements enable row level security;

drop policy if exists "admins manage announcements" on announcements;
create policy "admins manage announcements" on announcements
  for all using (is_admin()) with check (is_admin());

-- Signed-in users see only what is currently live and in-window.
drop policy if exists "live announcements readable" on announcements;
create policy "live announcements readable" on announcements
  for select using (
    auth.uid() is not null
    and live
    and starts_at <= now()
    and (ends_at is null or ends_at > now())
  );

-- ── Email templates ──────────────────────────────────────────────────────────
-- A record of every automated email, so support can see what a teacher was
-- sent. Sending itself is not wired up — no provider is configured — so the
-- engagement columns stay null rather than showing invented open rates.
create table if not exists email_templates (
  key                 text primary key,
  name                text not null,
  trigger_description text not null,
  subject             text,
  body                text,
  live                boolean not null default true,
  sent_30d            integer,
  open_rate           numeric(5,2),
  click_rate          numeric(5,2),
  updated_by          uuid references auth.users(id) on delete set null,
  updated_at          timestamptz not null default now(),
  sort                integer not null default 0
);

alter table email_templates enable row level security;

drop policy if exists "admins manage email templates" on email_templates;
create policy "admins manage email templates" on email_templates
  for all using (is_admin()) with check (is_admin());

insert into email_templates (key, name, trigger_description, subject, live, sort)
select * from (values
  ('welcome',           'Welcome',                 'Someone signs up',              'Welcome to Jooma', true, 1),
  ('verify_email',      'Verify your email',       'Signup, immediately',           'Confirm your email address', true, 2),
  ('school_invite',     'Invite to a school plan', 'Admin adds a teacher',          'You have been added to your school''s Jooma plan', true, 3),
  ('resources_low',     'Resources running low',   '80% of allowance used',         'You are running low on resources', true, 4),
  ('resources_out',     'Out of resources',        'Resource allowance hits zero',  'You have used this month''s resources', true, 5),
  ('ai_images_out',     'AI images used up',       'AI-image allowance hits zero',  'You have used your AI slideshow images', true, 6),
  ('payment_failed_1',  'Payment failed (1 of 3)', 'Card declined',                 'Your payment did not go through', true, 7),
  ('payment_failed_2',  'Payment failed (2 of 3)', 'Card declined, day 3',          'Update your card to keep Jooma', true, 8),
  ('payment_failed_3',  'Payment failed (3 of 3)', 'Card declined, day 7',          'Final reminder: update your card', true, 9),
  ('password_reset',    'Password reset',          'Requested',                     'Reset your Jooma password', true, 10),
  ('we_miss_you',       'We miss you',             '14 days inactive',              'Your lessons are waiting', false, 11),
  ('school_welcome',    'School welcome pack',     'School goes live',              'Getting started with Jooma', true, 12)
) as v(key, name, trigger_description, subject, live, sort)
where not exists (select 1 from email_templates);

-- ── Roles ────────────────────────────────────────────────────────────────────
-- An additive layer over is_admin(), not a replacement. Every admin_* RPC keeps
-- its is_admin() guard; roles gate the SENSITIVE subset on top. Anyone with
-- is_admin true but no admin_team row is treated as super_admin, so existing
-- admins keep working exactly as before this migration.
create table if not exists admin_team (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  role               text not null default 'support'
                       check (role in ('super_admin','support','finance','content','developer')),
  invited_by         uuid references auth.users(id) on delete set null,
  last_active_at     timestamptz,
  two_factor_enabled boolean not null default false,
  created_at         timestamptz not null default now()
);

alter table admin_team enable row level security;

drop policy if exists "admins read team" on admin_team;
create policy "admins read team" on admin_team
  for select using (is_admin());

drop policy if exists "admins write team" on admin_team;
create policy "admins write team" on admin_team
  for all using (is_admin()) with check (is_admin());

create table if not exists role_permissions (
  role       text not null,
  permission text not null,
  allowed    boolean not null default false,
  primary key (role, permission)
);

alter table role_permissions enable row level security;

drop policy if exists "permissions readable" on role_permissions;
create policy "permissions readable" on role_permissions
  for select using (is_admin());

-- The matrix from the console spec.
insert into role_permissions (role, permission, allowed)
select * from (values
  ('super_admin','see_teachers',true),   ('support','see_teachers',true),
  ('finance','see_teachers',true),       ('content','see_teachers',false),
  ('developer','see_teachers',true),

  ('super_admin','reset_passwords',true),('support','reset_passwords',true),
  ('finance','reset_passwords',false),   ('content','reset_passwords',false),
  ('developer','reset_passwords',false),

  ('super_admin','view_as_teacher',true),('support','view_as_teacher',true),
  ('finance','view_as_teacher',false),   ('content','view_as_teacher',false),
  ('developer','view_as_teacher',false),

  ('super_admin','grant_allowance',true),('support','grant_allowance',true),
  ('finance','grant_allowance',false),   ('content','grant_allowance',false),
  ('developer','grant_allowance',false),

  ('super_admin','change_plan',true),    ('support','change_plan',false),
  ('finance','change_plan',true),        ('content','change_plan',false),
  ('developer','change_plan',false),

  ('super_admin','issue_refunds',true),  ('support','issue_refunds',false),
  ('finance','issue_refunds',true),      ('content','issue_refunds',false),
  ('developer','issue_refunds',false),

  ('super_admin','edit_copy',true),      ('support','edit_copy',false),
  ('finance','edit_copy',false),         ('content','edit_copy',true),
  ('developer','edit_copy',false),

  ('super_admin','onboard_school',true), ('support','onboard_school',true),
  ('finance','onboard_school',true),     ('content','onboard_school',false),
  ('developer','onboard_school',false),

  ('super_admin','toggle_tools',true),   ('support','toggle_tools',false),
  ('finance','toggle_tools',false),      ('content','toggle_tools',false),
  ('developer','toggle_tools',true),

  ('super_admin','manage_admins',true),  ('support','manage_admins',false),
  ('finance','manage_admins',false),     ('content','manage_admins',false),
  ('developer','manage_admins',false),

  ('super_admin','export_personal_data',true), ('support','export_personal_data',false),
  ('finance','export_personal_data',false),    ('content','export_personal_data',false),
  ('developer','export_personal_data',false)
) as v(role, permission, allowed)
where not exists (select 1 from role_permissions);

-- The caller's role. Defaults to super_admin for an is_admin user with no team
-- row, so this migration cannot lock anyone out of what they could already do.
create or replace function admin_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not coalesce((select is_admin from profiles where id = auth.uid()), false)
      then null
    else coalesce((select t.role from admin_team t where t.user_id = auth.uid()), 'super_admin')
  end;
$$;
revoke execute on function admin_role() from anon, public;
grant execute on function admin_role() to authenticated;

create or replace function admin_can(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select rp.allowed from role_permissions rp
    where rp.role = admin_role() and rp.permission = p_permission
  ), false);
$$;
revoke execute on function admin_can(text) from anon, public;
grant execute on function admin_can(text) to authenticated;

-- ── App settings ─────────────────────────────────────────────────────────────
create table if not exists app_settings (
  key         text primary key,
  label       text not null,
  description text,
  section     text not null default 'general',
  value       jsonb not null default 'false'::jsonb,
  updated_by  uuid references auth.users(id) on delete set null,
  updated_at  timestamptz not null default now(),
  sort        integer not null default 0
);

alter table app_settings enable row level security;

drop policy if exists "admins manage settings" on app_settings;
create policy "admins manage settings" on app_settings
  for all using (is_admin()) with check (is_admin());

insert into app_settings (key, label, description, section, value, sort)
select * from (values
  ('signups_open', 'Signups open', 'Turn off to run a closed beta.', 'access', 'true'::jsonb, 1),
  ('maintenance_mode', 'Maintenance mode', 'Shows a holding page. Admins can still get in.', 'access', 'false'::jsonb, 2),
  ('require_2fa', 'Require 2FA for admins', 'Applies to everyone on the team page.', 'access', 'false'::jsonb, 3),
  ('google_signin', 'Google sign-in for teachers', 'Most schools are Google or Microsoft.', 'access', 'true'::jsonb, 4),
  ('microsoft_signin', 'Microsoft sign-in for teachers', null, 'access', 'false'::jsonb, 5),
  ('rate_limit_per_hour', 'Rate limit', 'Maximum generations per teacher per hour.', 'fair_use', '40'::jsonb, 10),
  ('alert_negative_margin', 'Alert on negative margin', 'When a paying teacher costs more than they pay.', 'fair_use', 'true'::jsonb, 11),
  ('flag_concurrent_sessions', 'Flag concurrent sessions', 'Two or more devices in different places usually means a shared login.', 'fair_use', 'true'::jsonb, 12),
  ('block_disposable_email', 'Block disposable email domains', 'Stops people farming the free plan.', 'fair_use', 'true'::jsonb, 13),
  ('log_generation_cost', 'Log real cost per generation', 'Leave this on. Every cost figure in this console depends on it.', 'fair_use', 'true'::jsonb, 14)
) as v(key, label, description, section, value, sort)
where not exists (select 1 from app_settings);
