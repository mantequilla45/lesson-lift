-- ── Make the role system load-bearing ────────────────────────────────────────
--
-- Roles have existed since 20260805001700 but have never bitten: every admin
-- has no admin_team row, and admin_role() resolves that to super_admin. The
-- next migration makes the permission matrix editable from the console, which
-- turns role_permissions from a reference table into an access control
-- mechanism. Two things have to be true before that is safe.
--
-- ── WHY THE WRITE POLICY GOES ──
-- admin_team carried "admins write team" FOR ALL USING (is_admin()) WITH CHECK
-- (is_admin()). admin_set_role() has always refused to demote the last super
-- admin, but that guard lived in the function while the table itself was
-- writable by any admin over PostgREST:
--
--   supabase.from("admin_team").upsert({ user_id, role: "content" })
--
-- would sail straight past it. The guard was advisory, not enforced. That has
-- not mattered while every admin was a de facto super admin; it matters the
-- moment a role can actually deny something. So the write path becomes
-- RPC-only, exactly as admin_audit_log and role_permissions already are: the
-- select policy stays, and nothing replaces the write policy. Every mutation
-- goes through a security-definer function that carries the guards with it.
--
-- ── WHY `protected` EXISTS ──
-- The matrix is about to become editable, and one cell in it is load-bearing
-- for the matrix itself: super_admin/manage_admins. Unticking it revokes the
-- permission that admin_set_permission() requires — so nobody could grant it
-- back, from any UI, ever. The console would have permanently locked every
-- human out of role management, repairable only by hand-written SQL against
-- the database.
--
-- This is a column rather than a hardcoded pair of string comparisons inside
-- the function because the UI needs to *know* which cells are locked, so it can
-- render a padlock instead of offering a toggle that always errors.
-- admin_role_matrix() returns it in the next migration and the check costs
-- nothing.

drop policy if exists "admins write team" on admin_team;

alter table role_permissions
  add column if not exists protected boolean not null default false;

update role_permissions
   set protected = true
 where role = 'super_admin' and permission = 'manage_admins';
