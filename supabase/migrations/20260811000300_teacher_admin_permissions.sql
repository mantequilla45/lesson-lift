-- Two new staff permissions for actions that didn't exist when the role matrix
-- was seeded. Without these rows admin_can() returns false for every role, so
-- the Suspend and Invite buttons would be permanently disabled.
--
-- Shaped like the closest existing permission: suspending is a support action
-- (support already has reset_passwords), and inviting is an access-granting one
-- that super admins and support both need. Finance, content and developer get
-- neither.
--
-- Note the original seed in 20260805001700_content_and_roles.sql guarded its
-- insert with `where not exists (select 1 from role_permissions)` — an
-- all-or-nothing check that would skip this insert entirely now the table is
-- populated. `on conflict do nothing` against the (role, permission) primary
-- key is the right idempotency guard here.
insert into role_permissions (role, permission, allowed)
values
  ('super_admin', 'suspend_accounts', true),
  ('support',     'suspend_accounts', true),
  ('finance',     'suspend_accounts', false),
  ('content',     'suspend_accounts', false),
  ('developer',   'suspend_accounts', false),

  ('super_admin', 'invite_teachers',  true),
  ('support',     'invite_teachers',  true),
  ('finance',     'invite_teachers',  false),
  ('content',     'invite_teachers',  false),
  ('developer',   'invite_teachers',  false)
on conflict (role, permission) do nothing;
