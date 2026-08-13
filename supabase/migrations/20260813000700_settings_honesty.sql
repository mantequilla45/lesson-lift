-- ── Settings: make each switch real, or remove it ────────────────────────────
--
-- Same standard 20260812130049 applied to the fair-use block, now applied to
-- the access block: an inert toggle is worse than an absent one, because an
-- absent control tells you a capability doesn't exist while a dead toggle tells
-- you it does.
--
-- Of the six rows in the 'access' section, only one was read by anything. This
-- migration makes three of them real, deletes two that describe capabilities
-- this product does not have, and leaves one labelled honestly in the UI.
--
-- ── DELETED: require_2fa ──
-- There is no 2FA in this product. auth.mfa_factors is empty, no enrolment UI
-- exists anywhere, and admin_team.two_factor_enabled has never been written by
-- any code path — the Team page's "N without 2FA" warning was accusing every
-- admin of a lapse that was neither real nor fixable. Worse, honouring this
-- setting as written would lock every admin out of the console the moment it
-- was switched on, since none of them can enrol. Deleted along with the 2FA
-- column on the Team page. When 2FA is built, it comes back with an enrolment
-- flow attached.
--
-- ── DELETED: microsoft_signin ──
-- Microsoft OAuth is not wired to anything: no provider call, no callback, no
-- button. Google's equivalent is real (app/signup and app/login both call
-- signInWithOAuth), which is exactly why it stays and this one goes.
--
-- ── KEPT AND ENFORCED: signups_open ──
-- Enforced in the profiles INSERT policy below. That policy is the one
-- chokepoint every signup path crosses: email signup, Google OAuth and invite
-- acceptance all end at a client-side upsert into profiles, and there is no
-- trigger on auth.users to hook instead.
--
-- Note what this does and does not do. It blocks the PROFILE, which is what
-- makes an account usable — a teacher without one can't reach any tool. The
-- auth.users row is still created; genuinely preventing that is a Supabase Auth
-- setting, not something app code can reach. The description says so.
--
-- The pending_invites escape hatch matters: closing signups must not silently
-- break invitations already sent, which would strand someone who did nothing
-- wrong and give no clue why.
--
-- ── KEPT AND ENFORCED: maintenance_mode, google_signin ──
-- Both read in app code (see app/lib/settings.ts). Descriptions rewritten to
-- state exactly what they do, including google_signin's real limit: it hides
-- the button, it does not revoke the provider.
--
-- ── KEPT, STILL UNENFORCED: block_disposable_email ──
-- Genuinely buildable and genuinely useful, but it needs a blocklist table and
-- a seed, which is a bigger job than this pass. It keeps its honest
-- description and now carries a visible "Not enforced yet" badge on the page
-- rather than relying on prose nobody reads.

delete from app_settings where key in ('require_2fa', 'microsoft_signin');

update app_settings
   set description = 'Turn off to run a closed beta. New accounts are refused at the database. Invites you have already sent still work, and existing teachers are unaffected.'
 where key = 'signups_open';

update app_settings
   set description = 'Teachers see a holding page instead of the app. Admins are unaffected and can still use this console.'
 where key = 'maintenance_mode';

update app_settings
   set label       = 'Google sign-in for teachers',
       description = 'Shows or hides the Continue with Google button on signup and login. This hides the button — it does not revoke the provider in Supabase Auth.'
 where key = 'google_signin';

-- Readable by anyone, including a signed-out visitor mid-signup.
--
-- A security-definer helper rather than a select policy on app_settings: the
-- table holds operational configuration and stays admin-only, and this exposes
-- exactly one boolean. Same shape as is_admin(), which policies throughout this
-- schema already call.
create or replace function signups_are_open()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select (value)::boolean from app_settings where key = 'signups_open'),
    true  -- a missing row must never be the thing that stops people signing up
  );
$$;
revoke execute on function signups_are_open() from public;
grant execute on function signups_are_open() to anon, authenticated;

-- Same as before plus the signups_open gate. Still self-only: a signed-in user
-- can only ever insert their own row.
--
-- NOTE: the invite half of this is corrected in 20260813000900 — the inline
-- subquery below reads pending_invites, which has RLS with no policies, so it
-- matches nothing. Left as written here so the history reflects what actually
-- happened rather than being quietly rewritten.
drop policy if exists "own profile insert" on profiles;
create policy "own profile insert" on profiles
  for insert with check (
    auth.uid() = id
    and (
      signups_are_open()
      or exists (
        select 1 from pending_invites i
        where lower(i.email) = lower(auth.jwt() ->> 'email')
          and i.accepted_at is null
          and i.expires_at > now()
      )
    )
  );
