-- Stop staging from silently granting new tables to anon/authenticated.
--
-- The original project carried ALTER DEFAULT PRIVILEGES on `public` handing
-- anon, authenticated and service_role full rights on every table, sequence
-- and function created thereafter. That is why our migrations never needed to
-- write a GRANT, and why the missing grants only surfaced on a project created
-- without that default — where every browser-side query died at the grant with
-- "permission denied for table profiles" while service-role server routes
-- carried on working. See 20260813080000_restore_table_grants.sql.
--
-- Leaving the default in place on one project and not the other is worse than
-- either setting on its own: a new table works in development and fails in
-- production, which is exactly the failure this repo just spent a day tracing.
-- This aligns the two so a forgotten grant fails where it is cheap to find.
--
-- Nothing here touches an existing object. ALTER DEFAULT PRIVILEGES only
-- governs objects created after it runs, so every current table keeps the
-- grants it already has and the running app is unaffected.
--
-- From now on, a migration that creates a table the browser reads must grant
-- it explicitly, next to the RLS policy:
--
--   alter table lesson_plans enable row level security;
--   create policy "own rows" on lesson_plans for all to authenticated
--     using ((select auth.uid()) = user_id)
--     with check ((select auth.uid()) = user_id);
--   grant select, insert, update, delete on lesson_plans to authenticated;
--
-- Tables reached only through security-definer RPCs or the service-role key
-- need no grant: the RPC runs as its owner, and service_role is covered by the
-- defaults re-established at the bottom of this file.

-- Withdraw the blanket future-grants to the browser roles. These statements
-- are scoped to objects created by `postgres`, which owns all 40 tables in
-- `public` and is the role migrations run as.
alter default privileges in schema public
  revoke all on tables from anon, authenticated;
alter default privileges in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges in schema public
  revoke all on functions from anon, authenticated;

-- Re-assert the service_role defaults so server routes keep working on tables
-- added later. Matches production exactly; repeated from 20260813080000 so
-- this file states the whole intended end state rather than half of it.
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant all on sequences to service_role;

-- Note on scope: staging also carries three `supabase_admin`-owned default ACL
-- entries that this migration cannot touch, because the migration role is
-- neither a superuser nor a member of supabase_admin. They are inert for our
-- purposes — supabase_admin owns no tables in `public` (its entries cover the
-- pgvector functions) and application tables are created by postgres, so the
-- revokes above cover every object this project actually creates.
