-- Invites no longer pre-create an auth user.
--
-- The previous design called auth.admin.generateLink, which creates the
-- auth.users row up front and emails a Supabase /auth/v1/verify link. Two
-- problems with that, and the second one made invites unusable:
--
--   1. The pre-created user has NO PASSWORD, so /create-password's signUp()
--      call fails with "already registered" and the teacher is stuck. There is
--      no path from that state to a working account.
--   2. A verify link returns its session in the URL FRAGMENT, which is never
--      sent to the server, so /auth/callback could not see it and bounced the
--      teacher to /login with "Could not sign you in."
--
-- So the invite is now just a row here plus an emailed link to
-- /signup?invite=<token>. The teacher signs up normally — Google or email —
-- and the invite is matched, verified and consumed at that point. No
-- passwordless auth user, no fragment, no Supabase link expiry.
--
-- The token is stored HASHED. This table is readable by admins, and a plaintext
-- token is a bearer credential — anyone who could read one could accept the
-- invite themselves and claim the seat.

create table if not exists pending_invites (
  id          uuid primary key default gen_random_uuid(),
  email       text        not null,
  plan        text        not null default 'free',
  -- sha256 of the token we emailed, hex-encoded. Unique so a lookup by hash is
  -- an index probe and two invites can never collide on the same secret.
  token_hash  text        not null unique,
  invited_by  uuid        references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid        references auth.users(id) on delete set null
);

-- At most one OPEN invite per address. Accepted ones are kept for the audit
-- trail, so the constraint is partial rather than a plain unique on email.
create unique index if not exists pending_invites_open_email_idx
  on pending_invites (lower(email))
  where accepted_at is null;

create index if not exists pending_invites_email_idx on pending_invites (lower(email));

-- No RLS policies: every read and write goes through the service-role client in
-- the invite/accept routes, or the security-definer functions below. Enabling
-- RLS with no policy denies all direct access from anon/authenticated, which is
-- exactly what we want for a table holding invite credentials.
alter table pending_invites enable row level security;

-- ── Membership check ─────────────────────────────────────────────────────────
-- Which of these addresses already belong to a fully onboarded teacher?
-- `profiles` has no email column (it's keyed to auth.users.id), and the client
-- SDK can't query the auth schema, so the join has to happen here.
--
-- Takes the whole batch in one call: the invite route handles up to 200
-- addresses, and a per-address round trip would be 200 queries.
-- #variable_conflict directs plpgsql to resolve an ambiguous name to the table
-- COLUMN rather than the RETURNS TABLE output parameter of the same name.
-- Without it `select ... u.email` against an out-param called `email` raises
-- "column reference is ambiguous" at runtime.
create or replace function existing_member_emails(p_emails text[])
returns table (email text)
language plpgsql stable security definer set search_path = public
as $$
#variable_conflict use_column
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    select lower(u.email::text)
    from auth.users u
    join profiles p on p.id = u.id
    where lower(u.email::text) = any (
      select lower(e) from unnest(p_emails) as e
    );
end;
$$;
revoke execute on function existing_member_emails(text[]) from anon, public;
grant execute on function existing_member_emails(text[]) to authenticated;

-- ── Issue an invite ──────────────────────────────────────────────────────────
-- Replaces any OPEN invite for the address and inserts a fresh one, so the
-- newest emailed link is the only one that works and an admin isn't blocked by
-- a stale invite they've forgotten about.
--
-- A function rather than a delete+insert pair in the route, for two reasons:
-- it's one statement, so the replace can't half-happen; and the match has to be
-- on lower(email) to mirror the partial unique index, which PostgREST can only
-- express as `ilike` — and `%`/`_` are legal in an email local-part, so that
-- would silently delete other people's invites.
--
-- Called with the service-role key from the invite route, which has already
-- run its own permission gate; the is_admin() check here is defence in depth
-- for the authenticated grant.
create or replace function upsert_invite(
  p_email      text,
  p_plan       text,
  p_token_hash text,
  p_invited_by uuid,
  p_expires_at timestamptz
)
returns void
language plpgsql volatile security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;

  delete from pending_invites
  where lower(email) = lower(p_email) and accepted_at is null;

  insert into pending_invites (email, plan, token_hash, invited_by, expires_at)
  values (lower(p_email), p_plan, p_token_hash, p_invited_by, p_expires_at);
end;
$$;
revoke execute on function upsert_invite(text, text, text, uuid, timestamptz) from anon, public;
grant execute on function upsert_invite(text, text, text, uuid, timestamptz) to authenticated;

-- ── Admin list ───────────────────────────────────────────────────────────────
-- Replaces the previous definition, which inferred a pending invite from "an
-- auth.users row with no profiles row". That gap no longer exists now that
-- invites don't pre-create the user, and it also caught self-signups mid-
-- onboarding. Reading the real table is both correct and cheaper.
--
-- Returns the same four columns as before so PendingInvites.tsx is unchanged,
-- plus expires_at so the UI can mark an invite as expired.
drop function if exists admin_pending_invites();

create or replace function admin_pending_invites()
returns table (
  id           uuid,
  email        text,
  invited_at   timestamptz,
  invited_plan text,
  expires_at   timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
#variable_conflict use_column
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    select i.id, i.email, i.created_at, i.plan, i.expires_at
    from pending_invites i
    where i.accepted_at is null
    order by i.created_at desc;
end;
$$;
revoke execute on function admin_pending_invites() from anon, public;
grant execute on function admin_pending_invites() to authenticated;
