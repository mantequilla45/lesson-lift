-- ── The settings the teacher-facing app is allowed to read ───────────────────
--
-- app_settings is admin-only by RLS ("admins manage settings" FOR ALL USING
-- (is_admin())), which is right: it holds operational configuration. But three
-- of its rows now change what a signed-out visitor sees, so something has to
-- expose them without opening the table.
--
-- The keys are listed explicitly rather than returning everything. A reader
-- that published the whole table would silently leak every future operational
-- setting the moment someone added one — this way, publishing a setting is a
-- deliberate edit to this function.
--
-- signups_are_open() (20260813000700) stays as it is: it is called from inside
-- the profiles INSERT policy, where a single boolean is all that's wanted and a
-- set-returning function would be awkward.
create or replace function public_settings()
returns table (key text, value jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select s.key, s.value from app_settings s
  where s.key in ('signups_open', 'maintenance_mode', 'google_signin');
$$;
revoke execute on function public_settings() from public;
grant execute on function public_settings() to anon, authenticated;
