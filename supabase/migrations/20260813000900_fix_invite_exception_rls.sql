-- ── The invite exception in the last migration never fired ───────────────────
--
-- 20260813000700 gated the profiles INSERT policy on signups_open, with an
-- exception for anyone already holding an open invite — so that closing signups
-- could not strand teachers who had been invited before it was switched off.
--
-- That exception was written as an inline
-- `exists (select 1 from pending_invites ...)` inside the policy, and it never
-- matched anything. pending_invites has RLS enabled with NO policies at all
-- (deliberate total denial — see 20260812000200_invite_tokens.sql), so a
-- subquery evaluated as `authenticated` reads zero rows no matter what is in
-- the table. The exception silently evaluated to false.
--
-- The failure mode is the nasty kind: everything looks right, the policy is
-- present and correct-looking, and the only symptom is an invited teacher
-- hitting a bare RLS error at the end of signup with nothing to explain it.
-- Caught by testing the branch rather than by reading it.
--
-- Fixed the same way signups_are_open() already was: a security-definer helper
-- that reads the table on the caller's behalf and returns one boolean. It takes
-- the address as an argument rather than reading auth.jwt() itself, so the
-- policy stays legible about what it matches on.
--
-- The argument is then required to EQUAL the caller's own JWT email. Without
-- that, a security-definer function granted to `anon` and taking any address
-- would answer "has this person been invited to Jooma?" for any address a
-- stranger cared to try, one call at a time over PostgREST. Nothing needs that
-- — the only caller passes the caller's own address — so the function can now
-- only confirm something the caller already knows.
create or replace function has_open_invite(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from pending_invites i
    where lower(i.email) = lower(p_email)
      and lower(p_email) = lower(auth.jwt() ->> 'email')
      and i.accepted_at is null
      and i.expires_at > now()
  );
$$;
revoke execute on function has_open_invite(text) from public;
grant execute on function has_open_invite(text) to anon, authenticated;

drop policy if exists "own profile insert" on profiles;
create policy "own profile insert" on profiles
  for insert with check (
    auth.uid() = id
    and (signups_are_open() or has_open_invite(auth.jwt() ->> 'email'))
  );
