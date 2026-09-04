-- ── Enquiries: grant tidy-up ─────────────────────────────────────────────────
--
-- Follow-up to 20260908000000_enquiries.sql. Nothing here is exploitable on the
-- database as it stands, but two grants are wider than the house convention and
-- one of them is only harmless by accident.
--
-- 1. next_enquiry_reference() kept Postgres's default EXECUTE to PUBLIC. The
--    codebase already had to fix exactly this once before, across every admin
--    RPC, in 20260805000200_revoke_anon_from_admin_rpcs.sql. Today anon calling
--    it fails anyway on "permission denied for sequence", so the only thing
--    standing between a stranger and burning reference numbers is a grant that
--    was never given rather than one that was deliberately withheld. Make the
--    intent explicit instead of relying on the accident.
--
--    It stays callable by `authenticated` for no reason other than symmetry with
--    the rest of the file; nothing outside submit_enquiry() calls it, and
--    submit_enquiry() is security definer so it does not need the grant at all.
--
-- 2. `authenticated` holds UPDATE on enquiries and INSERT on enquiry_replies.
--    Both are already refused by the admin-only RLS policies, verified against
--    staging: a non-admin UPDATE touches zero rows. But every write in this
--    feature goes through a security definer RPC, which bypasses RLS and needs
--    no table grant, so the grants buy nothing and widen what a future policy
--    change would expose. Revoke them and leave SELECT, which the admin console
--    reads through.

revoke execute on function next_enquiry_reference() from public;
grant execute on function next_enquiry_reference() to authenticated;

-- Writes go through admin_set_enquiry() and admin_enquiry_reply(), both of
-- which are security definer. Reads stay, gated by the admin-only policies.
revoke update on enquiries from authenticated;
revoke insert on enquiry_replies from authenticated;

-- The database linter flags enquiry_rate as "RLS enabled, no policy" (INFO,
-- lint 0008). That is the intended state, not an oversight: RLS on with zero
-- policies and zero grants means only the service role reaches the table, which
-- is exactly right for a throttle log. A policy here would be the thing that
-- widened it. Recorded as a comment on the table so the next person to read the
-- linter output finds the reason attached to the object rather than only in a
-- migration they would have to go looking for.
comment on table enquiry_rate is
  'Per-IP submission log for the /api/enquiries throttle. RLS is enabled with no policies and no grants on purpose: only the service role should ever read or write it. The database linter reports this as lint 0008 (RLS Enabled No Policy); that finding is expected here.';
