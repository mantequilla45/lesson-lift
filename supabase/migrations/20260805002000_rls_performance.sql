-- ── RLS performance ──────────────────────────────────────────────────────────
-- Postgres re-evaluates `auth.uid()` and `is_admin()` once PER ROW when they
-- appear bare in a policy. Wrapping them in a scalar subselect — `(select
-- is_admin())` — lets the planner treat the result as a constant for the whole
-- query, evaluating it once.
--
-- On a 10-row staging table this is invisible. On tool_runs or token_usage with
-- real traffic it is the difference between one function call and one per row,
-- which is exactly the kind of thing that looks fine until it doesn't.
--
-- Behaviour is identical; only the plan changes.

-- Covering indexes for foreign keys the advisor flagged. Each of these is a
-- column we join or filter on (who granted this, who reviewed that, which
-- school owns this), so an unindexed FK means a sequential scan.
create index if not exists allowance_grants_granted_by_idx    on allowance_grants (granted_by);
create index if not exists schools_created_by_idx             on schools (created_by);
create index if not exists school_admins_user_idx             on school_admins (user_id);
create index if not exists invoices_stripe_charge_idx         on invoices (stripe_charge_id);
create index if not exists topup_purchases_pack_idx           on topup_purchases (pack_id);
create index if not exists support_threads_assigned_idx       on support_threads (assigned_to);
create index if not exists support_threads_school_idx         on support_threads (school_id);
create index if not exists support_messages_author_idx        on support_messages (author_id);
create index if not exists safeguarding_flags_reviewed_by_idx on safeguarding_flags (reviewed_by);
create index if not exists safeguarding_flags_run_idx         on safeguarding_flags (tool_run_id);
create index if not exists announcements_school_idx           on announcements (school_id);
create index if not exists announcements_created_by_idx       on announcements (created_by);
create index if not exists copy_block_versions_published_by_idx on copy_block_versions (published_by);
create index if not exists admin_team_invited_by_idx          on admin_team (invited_by);

-- ── Policy rewrites ──────────────────────────────────────────────────────────
-- Each policy is dropped and recreated by its exact name, keeping any
-- owner-scoped policy alongside the admin one.
drop policy if exists "own grants read" on allowance_grants;
create policy "own grants read" on allowance_grants
  for select using ((select auth.uid()) = user_id or (select is_admin()));

drop policy if exists "admins manage schools" on schools;
create policy "admins manage schools" on schools
  for all using ((select is_admin())) with check ((select is_admin()));

drop policy if exists "members read own school" on schools;
create policy "members read own school" on schools
  for select using (
    exists (select 1 from profiles p
            where p.id = (select auth.uid()) and p.school_id = schools.id)
  );

drop policy if exists "admins manage seats" on school_seats;
create policy "admins manage seats" on school_seats
  for all using ((select is_admin())) with check ((select is_admin()));

drop policy if exists "own seat read" on school_seats;
create policy "own seat read" on school_seats
  for select using ((select auth.uid()) = user_id);

drop policy if exists "admins manage school admins" on school_admins;
create policy "admins manage school admins" on school_admins
  for all using ((select is_admin())) with check ((select is_admin()));

drop policy if exists "own school admin read" on school_admins;
create policy "own school admin read" on school_admins
  for select using ((select auth.uid()) = user_id);

drop policy if exists "admins manage invoices" on invoices;
create policy "admins manage invoices" on invoices
  for all using ((select is_admin())) with check ((select is_admin()));

drop policy if exists "own invoices read" on invoices;
create policy "own invoices read" on invoices
  for select using ((select auth.uid()) = user_id);

drop policy if exists "own topups read" on topup_purchases;
create policy "own topups read" on topup_purchases
  for select using ((select auth.uid()) = user_id or (select is_admin()));

drop policy if exists "admins write topups" on topup_purchases;
create policy "admins write topups" on topup_purchases
  for all using ((select is_admin())) with check ((select is_admin()));

drop policy if exists "tool settings readable" on tool_settings;
create policy "tool settings readable" on tool_settings
  for select using ((select auth.uid()) is not null);

drop policy if exists "admins write tool settings" on tool_settings;
create policy "admins write tool settings" on tool_settings
  for all using ((select is_admin())) with check ((select is_admin()));

drop policy if exists "admins manage announcements" on announcements;
create policy "admins manage announcements" on announcements
  for all using ((select is_admin())) with check ((select is_admin()));

drop policy if exists "live announcements readable" on announcements;
create policy "live announcements readable" on announcements
  for select using (
    (select auth.uid()) is not null
    and live and starts_at <= now()
    and (ends_at is null or ends_at > now())
  );
