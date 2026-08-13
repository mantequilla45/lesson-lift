-- Only ever answers about the caller's own address.
--
-- The previous version took any email and returned a boolean, which let an
-- anonymous caller ask "has this address been invited?" one address at a time
-- over PostgREST. Nothing needed that: the sole caller is the profiles INSERT
-- policy, passing the caller's own JWT email. Now the argument has to match
-- that JWT, so the function can only confirm what the caller already knows.
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
