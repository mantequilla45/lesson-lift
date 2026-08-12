-- Invited-but-not-yet-onboarded teachers were showing up in the Teachers tab
-- itself: admin_users() joined FROM auth.users, and an invite's generateLink
-- call creates the auth.users row immediately, long before the teacher sets a
-- password or fills in complete-profile (which is what inserts the profiles
-- row). That made every pending invite look like a real account with a blank
-- name and no plan.
--
-- Fix: admin_users() now starts FROM profiles, so only teachers who finished
-- onboarding appear there. A separate admin_pending_invites() surfaces the
-- rest, so admins still have visibility into who hasn't accepted yet.
--
-- Same drop/recreate-in-one-file shape as 20260811000200_admin_users_suspended
-- for the return-type change.

drop function if exists admin_users();

create or replace function admin_users()
returns table (
  id uuid, email text, first_name text, surname text,
  plan text, subscription_status text, is_admin boolean, created_at timestamptz,
  generations bigint, generations_this_month bigint, cost_usd numeric,
  ai_images_this_month bigint, resources_topup bigint, ai_topup bigint,
  school_id uuid, school_name text,
  suspended_at timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    select
      u.id, u.email::text, p.first_name, p.surname, p.plan, p.subscription_status,
      coalesce(p.is_admin, false), u.created_at,
      coalesce(r.gens, 0), coalesce(rm.gens, 0),
      coalesce(tu.cost, 0) + coalesce(ac.cost, 0),
      coalesce(img.units, 0),
      coalesce(gr.resource_topup, 0), coalesce(gr.ai_topup, 0),
      p.school_id, sc.name,
      p.suspended_at
    from profiles p
    join auth.users u on u.id = p.id
    left join schools sc on sc.id = p.school_id
    left join (select tr.user_id, count(*) as gens from tool_runs tr group by tr.user_id) r
      on r.user_id = u.id
    left join (
      select tr2.user_id, count(*) as gens from tool_runs tr2
      where tr2.created_at >= date_trunc('month', now()) group by tr2.user_id
    ) rm on rm.user_id = u.id
    left join (select t2.user_id, sum(t2.cost_usd) as cost from token_usage t2 group by t2.user_id) tu
      on tu.user_id = u.id
    left join (select a2.user_id, sum(a2.cost_usd) as cost from asset_cost a2 group by a2.user_id) ac
      on ac.user_id = u.id
    left join (
      select a3.user_id, sum(a3.units)::bigint as units from asset_cost a3
      where a3.kind = 'image' and a3.created_at >= date_trunc('month', now())
      group by a3.user_id
    ) img on img.user_id = u.id
    left join (
      select g.user_id,
        sum(g.amount) filter (where g.kind = 'resource')::bigint as resource_topup,
        sum(g.amount) filter (where g.kind = 'ai_image')::bigint as ai_topup
      from allowance_grants g
      where g.created_at >= date_trunc('month', now())
        and (g.expires_at is null or g.expires_at > now())
      group by g.user_id
    ) gr on gr.user_id = u.id
    order by u.created_at desc;
end;
$$;
revoke execute on function admin_users() from anon, public;
grant execute on function admin_users() to authenticated;

-- ── Pending invites ──────────────────────────────────────────────────────────
-- An auth user with no matching profiles row is exactly the invited-not-yet-
-- accepted state (self-signups only reach that gap for the few seconds between
-- signUp() and the complete-profile upsert, which is fine — this is an admin
-- list, not a real-time guarantee). invited_plan comes back out of the metadata
-- stashed at invite time so the admin can see what plan was promised.
create or replace function admin_pending_invites()
returns table (
  id           uuid,
  email        text,
  invited_at   timestamptz,
  invited_plan text
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    select u.id, u.email::text, u.created_at, u.raw_user_meta_data->>'invited_plan'
    from auth.users u
    left join profiles p on p.id = u.id
    where p.id is null
    order by u.created_at desc;
end;
$$;
revoke execute on function admin_pending_invites() from anon, public;
grant execute on function admin_pending_invites() to authenticated;

create or replace function admin_log_revoke_invite(p_email text)
returns void
language plpgsql volatile security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  perform admin_log(
    'Revoked an invite',
    'access', 'user', null, p_email,
    '{}'::jsonb
  );
end;
$$;
revoke execute on function admin_log_revoke_invite(text) from anon, public;
grant execute on function admin_log_revoke_invite(text) to authenticated;
