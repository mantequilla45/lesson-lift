-- ── Managing admins from the console ─────────────────────────────────────────
--
-- Until now nothing in the entire app could set profiles.is_admin. Admins were
-- made by hand in the SQL editor, and the Team page could only change the role
-- of someone who was already one. This adds the two missing halves — granting
-- and revoking admin access — plus the write path for the permission matrix.
--
-- ── WHY PROMOTION, NOT INVITATION ──
-- An admin has to exist in auth.users first, so "add admin" is either "promote
-- someone who already has an account" or "email an invite to a stranger". This
-- does the former. The invite path would mean teaching pending_invites to carry
-- an admin role and then trusting /api/invites/accept — a public,
-- token-authenticated endpoint — to set is_admin. A bearer token sitting in an
-- inbox that grants console access is a materially different proposition from
-- one that grants a Pro seat, and it is not a trade worth making for an event
-- that happens a few times a year. Someone who needs admin access can sign up
-- at /signup first, which takes half a minute.
--
-- Note that admin_grant_admin is also the function an invite flow would call at
-- the end of itself, so nothing here is wasted if that changes.

-- Promote an existing user to admin.
--
-- Writes both halves of what "is an admin" means: profiles.is_admin (the
-- security boundary every admin_* RPC checks) and the admin_team row (the
-- role). Doing only the first would silently create a super admin, since
-- admin_role() resolves a missing team row to super_admin.
create or replace function admin_grant_admin(uid uuid, p_role text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v_email text; v_already boolean;
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  if not admin_can('manage_admins') then
    raise exception 'your role cannot manage admins';
  end if;
  if p_role not in ('super_admin','support','finance','content','developer') then
    raise exception 'invalid role';
  end if;

  select u.email::text, coalesce(p.is_admin, false)
    into v_email, v_already
  from profiles p
  join auth.users u on u.id = p.id
  where p.id = uid;

  if v_email is null then raise exception 'no such user'; end if;
  -- Not an error worth being clever about, but worth being explicit: silently
  -- succeeding here would let this be used to change an existing admin's role
  -- while bypassing admin_set_role's last-super-admin guard.
  if v_already then raise exception 'already an admin'; end if;

  update profiles set is_admin = true where id = uid;

  insert into admin_team (user_id, role, invited_by)
  values (uid, p_role, auth.uid())
  on conflict (user_id) do update set role = excluded.role;

  perform admin_log('Made an admin', 'access', 'admin', uid::text, v_email,
    jsonb_build_object('role', p_role));
end;
$$;
revoke execute on function admin_grant_admin(uuid, text) from anon, public;
grant execute on function admin_grant_admin(uuid, text) to authenticated;

-- Remove someone's admin access entirely.
create or replace function admin_revoke_admin(uid uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v_email text; v_role text; v_supers integer;
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  if not admin_can('manage_admins') then
    raise exception 'your role cannot manage admins';
  end if;

  -- Removing your own access is always either a mis-click or a misunderstanding,
  -- and it is the one action on this page with no self-service way back: you
  -- lose the console in the same statement that would let you undo it.
  if uid = auth.uid() then
    raise exception 'you cannot remove your own admin access';
  end if;

  select u.email::text, coalesce(t.role, 'super_admin')
    into v_email, v_role
  from profiles p
  join auth.users u on u.id = p.id
  left join admin_team t on t.user_id = p.id
  where p.id = uid and p.is_admin;

  if v_email is null then raise exception 'not an admin'; end if;

  -- Counted with the same coalesce admin_role() uses. An is_admin user with no
  -- team row IS a super admin, so counting admin_team rows alone would report
  -- zero supers while four people held the power, and refuse every removal.
  if v_role = 'super_admin' then
    select count(*) into v_supers
    from profiles p
    left join admin_team t on t.user_id = p.id
    where p.is_admin and coalesce(t.role, 'super_admin') = 'super_admin'
      and p.id <> uid;
    if v_supers = 0 then
      raise exception 'cannot remove the last super admin';
    end if;
  end if;

  delete from admin_team where user_id = uid;
  update profiles set is_admin = false where id = uid;

  perform admin_log('Removed an admin', 'access', 'admin', uid::text, v_email,
    jsonb_build_object('was_role', v_role));
end;
$$;
revoke execute on function admin_revoke_admin(uuid) from anon, public;
grant execute on function admin_revoke_admin(uuid) to authenticated;

-- Edit one cell of the permission matrix.
create or replace function admin_set_permission(
  p_role text,
  p_permission text,
  p_allowed boolean
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v_protected boolean;
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  if not admin_can('manage_admins') then
    raise exception 'your role cannot manage admins';
  end if;

  select protected into v_protected
  from role_permissions
  where role = p_role and permission = p_permission;

  if v_protected is null then raise exception 'no such role permission'; end if;

  -- Switching a protected row off would make this very function unreachable
  -- for everyone, permanently. Switching one back on is always allowed — the
  -- guard exists to prevent a lockout, not to freeze the row.
  if v_protected and not p_allowed then
    raise exception 'super admins must keep the ability to manage admins';
  end if;

  update role_permissions
     set allowed = p_allowed
   where role = p_role and permission = p_permission;

  perform admin_log(
    case when p_allowed then 'Granted a role permission'
         else 'Revoked a role permission' end,
    'access', 'role_permission', p_role || '.' || p_permission,
    p_role || ' → ' || p_permission,
    jsonb_build_object('role', p_role, 'permission', p_permission,
                       'allowed', p_allowed));
end;
$$;
revoke execute on function admin_set_permission(text, text, boolean) from anon, public;
grant execute on function admin_set_permission(text, text, boolean) to authenticated;

-- Now returns `protected`, so the UI can render a locked cell as locked rather
-- than offering a toggle that always fails.
--
-- Dropped first: `create or replace` cannot change a function's return type,
-- and adding a column to a `returns table` is exactly that.
drop function if exists admin_role_matrix();
create or replace function admin_role_matrix()
returns table (permission text, role text, allowed boolean, protected boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    select rp.permission, rp.role, rp.allowed, rp.protected from role_permissions rp
    order by rp.permission, rp.role;
end;
$$;
revoke execute on function admin_role_matrix() from anon, public;
grant execute on function admin_role_matrix() to authenticated;

-- People who could be made an admin, for the Add admin picker.
--
-- Deliberately narrow: it answers "who can I promote", not "show me the user
-- table". Existing admins are excluded because promoting one is a no-op that
-- admin_grant_admin refuses anyway, and a short list keeps the modal readable.
create or replace function admin_searchable_users(q text)
returns table (id uuid, email text, name text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  if not admin_can('manage_admins') then
    raise exception 'your role cannot manage admins';
  end if;

  -- An empty search returns nothing rather than the first 20 users: this is a
  -- lookup for someone you already have in mind, and a pre-populated list of
  -- strangers invites promoting the wrong Sam.
  if q is null or btrim(q) = '' then return; end if;

  return query
    select u.id, u.email::text,
           nullif(trim(coalesce(p.first_name,'') || ' ' || coalesce(p.surname,'')), '')
    from profiles p
    join auth.users u on u.id = p.id
    where not coalesce(p.is_admin, false)
      and (u.email ilike '%' || q || '%'
        or coalesce(p.first_name,'') || ' ' || coalesce(p.surname,'') ilike '%' || q || '%')
    order by u.email
    limit 20;
end;
$$;
revoke execute on function admin_searchable_users(text) from anon, public;
grant execute on function admin_searchable_users(text) to authenticated;
