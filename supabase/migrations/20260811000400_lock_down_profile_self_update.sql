-- ── SECURITY: stop users editing their own plan / admin flag ─────────────────
--
-- The "own profile update" policy had a USING clause but no WITH CHECK. USING
-- only decides WHICH ROWS you may touch; WITH CHECK validates the row you
-- leave behind. With only USING, a signed-in user could rewrite any column on
-- their own row from the browser, using nothing but the anon key that ships in
-- the client bundle:
--
--   await supabase.from('profiles').update({ plan: 'pro' }).eq('id', myId)
--   await supabase.from('profiles').update({ is_admin: true }).eq('id', myId)
--
-- Both were confirmed to succeed against staging. The second is the serious
-- one: is_admin gates the whole admin console — every teacher's personal data,
-- the audit log, refunds — and every admin_* RPC trusts is_admin() as its
-- security boundary. Self-service Pro is the cheaper of the two problems.
--
-- The columns a user legitimately edits are their own name, phone and country
-- (/complete-profile and the account page). Everything else is set by us:
-- `plan`, `subscription_status`, `stripe_*` and `current_period_end` by the
-- Stripe webhook; `is_admin` and `school_id` by staff; the suspension columns
-- by the admin suspend route. All of those write with the service role, which
-- bypasses RLS, so locking this down costs the app nothing.
--
-- Enforced with a trigger rather than a WITH CHECK expression because a policy
-- cannot see OLD — it can only test the new row, which makes "unchanged from
-- what it was" inexpressible. The trigger compares OLD and NEW directly.

create or replace function profiles_guard_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The service role (webhooks, admin routes, migrations) legitimately changes
  -- these columns. It has no JWT, so auth.uid() is null — that is the signal
  -- this is a trusted server-side write rather than a browser one.
  if auth.uid() is null then
    return new;
  end if;

  -- Admins may edit these through the console; their routes re-check is_admin
  -- server-side before they get here.
  if is_admin() then
    return new;
  end if;

  if new.is_admin is distinct from old.is_admin then
    raise exception 'not authorized: is_admin cannot be changed here';
  end if;
  if new.plan is distinct from old.plan then
    raise exception 'not authorized: plan is set by billing, not by you';
  end if;
  if new.subscription_status is distinct from old.subscription_status
     or new.stripe_customer_id is distinct from old.stripe_customer_id
     or new.stripe_subscription_id is distinct from old.stripe_subscription_id
     or new.current_period_end is distinct from old.current_period_end then
    raise exception 'not authorized: billing fields are set by Stripe';
  end if;
  if new.school_id is distinct from old.school_id then
    raise exception 'not authorized: school membership is set by an admin';
  end if;
  if new.suspended_at is distinct from old.suspended_at
     or new.suspended_reason is distinct from old.suspended_reason
     or new.suspended_by is distinct from old.suspended_by then
    raise exception 'not authorized: suspension is set by an admin';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_privileged_columns_trg on profiles;
create trigger profiles_guard_privileged_columns_trg
  before update on profiles
  for each row
  execute function profiles_guard_privileged_columns();

-- The INSERT path needs the same treatment: "own profile insert" checks only
-- auth.uid() = id, so a brand-new user could sign up straight into
-- plan='pro', is_admin=true. /complete-profile legitimately inserts a row, so
-- this forces the privileged columns to their defaults rather than blocking it.
create or replace function profiles_guard_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or is_admin() then
    return new;
  end if;

  new.is_admin := false;
  new.school_id := null;
  new.subscription_status := null;
  new.stripe_customer_id := null;
  new.stripe_subscription_id := null;
  new.current_period_end := null;
  new.suspended_at := null;
  new.suspended_reason := null;
  new.suspended_by := null;

  -- An admin-invited teacher has their plan stashed on the auth user at invite
  -- time (see /api/admin/teachers/invite). Honour that, but only that — it was
  -- written by the service role, so it is not user-controlled. Anything else
  -- falls back to free.
  if new.plan is distinct from 'free' then
    if coalesce(
         (select (raw_user_meta_data ->> 'invited_plan') from auth.users where id = new.id),
         'free'
       ) is distinct from new.plan then
      new.plan := 'free';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_insert_trg on profiles;
create trigger profiles_guard_insert_trg
  before insert on profiles
  for each row
  execute function profiles_guard_insert();
