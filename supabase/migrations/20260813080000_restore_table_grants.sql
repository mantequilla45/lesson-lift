-- Give anon/authenticated the front-door key to the tables they already have
-- RLS policies for.
--
-- Postgres gates every table twice: the GRANT decides whether a role may touch
-- the table at all, and the RLS policy decides which rows it then sees. Our
-- migrations only ever wrote the second gate, because on the original project
-- the first one was handled invisibly by ALTER DEFAULT PRIVILEGES on `public`
-- — a project-level setting, not schema, so `db push` never carried it. On a
-- project without that default, every browser-side query dies at the grant
-- with "permission denied for table profiles" before RLS is consulted, while
-- server routes on the service-role key carry on working. That split is what
-- makes it easy to miss: the admin console looks healthy, teachers cannot
-- sign in.
--
-- These grants restore the missing gate and nothing more. They do not widen
-- access: every table below has RLS enabled with policies already written, and
-- those policies are what actually scope the rows. Tables reached only through
-- security-definer RPCs are granted nothing here — the RPC already runs as its
-- owner, so a direct grant would be strictly more access than the app needs.

-- Teacher-owned data. RLS scopes each of these to auth.uid().
grant select, insert, update, delete on presentations       to authenticated;
grant select, insert, update, delete on generated_images    to authenticated;
grant select, insert, update, delete on tool_runs           to authenticated;
grant select, insert, update, delete on token_usage         to authenticated;
grant select, insert, update, delete on asset_cost          to authenticated;
grant select, insert, update, delete on slide_cost          to authenticated;

-- The caller's own profile row. INSERT is needed for the complete-profile
-- step; the privileged-column guard trigger and the self-update lockdown
-- (20260811000400) still police which columns a teacher may change.
grant select, insert, update on profiles to authenticated;

-- Support: teachers read and write their own threads via my_* RPCs, but the
-- reply/read paths also touch these tables directly under the user's JWT.
grant select, insert, update on support_threads  to authenticated;
grant select, insert         on support_messages to authenticated;

-- Announcements: teachers read live ones and record their own seen/dismissed
-- rows. The counters themselves are moved by security-definer RPCs.
grant select                 on announcements           to authenticated;
grant select, insert         on announcement_views      to authenticated;
grant select, insert, delete on announcement_dismissals to authenticated;

-- Read-only config the signed-in UI renders directly (plan cards, tool
-- availability, top-up packs, seat pricing).
grant select on plan_config    to authenticated;
grant select on tool_settings  to authenticated;
grant select on topup_packs    to authenticated;
grant select on seat_bands     to authenticated;
grant select on app_settings   to authenticated;

-- Billing history the account pages show the owning teacher.
grant select on invoices         to authenticated;
grant select on topup_purchases  to authenticated;
grant select on allowance_grants to authenticated;

-- School context for teachers who belong to one, and for school admins.
grant select on schools       to authenticated;
grant select on school_seats  to authenticated;
grant select on school_admins to authenticated;
grant select on trusts        to authenticated;

-- Signed-out surfaces. public_copy was already granted in
-- 20260813000800_public_settings_reader.sql; repeated here so this file is a
-- complete statement of what the browser roles may reach.
grant select on public_copy to anon, authenticated;

-- service_role backs the server routes and is expected to bypass RLS wholesale.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- Keep future tables from re-opening this gap. Matches the default the
-- original project had, so the two databases stop drifting.
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant all on sequences to service_role;
