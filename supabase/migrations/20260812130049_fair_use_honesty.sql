-- ── Fair use: keep the settings that can be enforced, remove the rest ────────
--
-- app_settings has carried five "fair use and abuse" rows since
-- 20260805001700. All five persisted correctly, were audited, and were read by
-- NOTHING. An operator could switch any of them and watch it do nothing.
--
-- An inert toggle in an admin console is worse than an absent one. An absent
-- control tells you the capability does not exist; a dead toggle tells you it
-- does, and invites someone to believe abuse is being handled when it is not.
-- So each row is either made real or deleted — nothing stays decorative.
--
-- Kept and now enforced:
--   rate_limit_per_hour     -> read by my_generation_gate() (20260812130107)
--   alert_negative_margin   -> gates the warning banner on /admin/usage
--
-- Deleted:
--   flag_concurrent_sessions
--   log_generation_cost
--
-- Moved:
--   block_disposable_email  -> the 'access' section, beside signups_open
--
-- WHY flag_concurrent_sessions GOES.
-- Nothing in this product records a session's location, IP or device.
-- Supabase's auth sessions are not exposed to the app, so detecting a shared
-- login would mean building an access log first — collecting personal data
-- about teachers, which for a UK schools product is a GDPR decision that needs
-- taking deliberately and has not been asked for. A toggle claiming to detect
-- shared logins while no such capability exists is the worst of both.
--
-- WHY log_generation_cost GOES.
-- It is already always-on, and it is structurally load-bearing rather than
-- optional. recordUsage() writes token_usage, and my_generation_gate() COUNTS
-- token_usage to enforce the free plan's daily and monthly caps. Turning this
-- "off" would not merely lose reporting — it would give every free account
-- unlimited generations and blind the spend ceiling at the same time. Offering
-- that as a switch is offering a footgun labelled "leave this on", which is
-- precisely what its own description said.
--
-- WHY block_disposable_email MOVES RATHER THAN DIES.
-- It is genuinely buildable (a domain blocklist checked at signup) and
-- genuinely useful against free-plan farming. But it belongs to the SIGNUP
-- path, not the generation path. Sitting in the fair-use block on
-- /admin/usage it implied it gated generation, which it never would. Moved
-- beside signups_open where it will make sense when it is built, and its
-- description now says plainly that it is not yet enforced.

delete from app_settings where key in ('flag_concurrent_sessions', 'log_generation_cost');

update app_settings
   set section     = 'access',
       sort        = 6,
       description = 'Stops people farming the free plan. Not enforced yet — recorded here so the signup path can read it when it is built.'
 where key = 'block_disposable_email';

-- The two survivors describe what they actually do now, rather than what
-- someone hoped they would do.
update app_settings
   set description = 'Maximum generations per teacher per hour, counted on a rolling hour. Enforced on every generation. Set to 0 for no limit.'
 where key = 'rate_limit_per_hour';

update app_settings
   set label       = 'Warn on negative margin',
       description = 'Shows a warning on this page when a paying teacher costs more than they pay. In-console only — there is no email alerting yet.'
 where key = 'alert_negative_margin';
