-- ── Announcements: the teacher half ──────────────────────────────────────────
-- /admin/announce could compose, schedule and publish, and AnnounceView said so
-- in a warning note: "the teacher dashboard doesn't render them yet — the
-- banner component is separate work. Counts stay at zero until it does."
--
-- This is that work, on the database side. Three things were missing and one
-- was wrong:
--
--   missing   somewhere to record that a teacher dismissed a banner, so it
--             stays dismissed on their other devices
--   missing   somewhere to record that a teacher saw one, so seen_count counts
--             people rather than page loads
--   missing   a read the teacher app can call that filters by audience
--   wrong     the RLS policy checked live and the date window but not audience,
--             so a "Free plan only" announcement was readable over PostgREST by
--             any signed-in teacher on any plan
--
-- Also fixes admin_upsert_announcement, which could not move starts_at or clear
-- ends_at on an existing row.

-- ── Dismissals ───────────────────────────────────────────────────────────────
-- Server-side rather than localStorage: a teacher who dismisses a banner on
-- their laptop at home should not meet it again on the classroom desktop.
create table if not exists announcement_dismissals (
  announcement_id uuid not null references announcements(id) on delete cascade,
  user_id         uuid not null references auth.users(id)    on delete cascade,
  dismissed_at    timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

-- The banner's read is "everything live, minus what this user dismissed", which
-- filters by user_id and not by announcement_id, so the PK's leading column is
-- the wrong way round for it.
create index if not exists announcement_dismissals_user_idx
  on announcement_dismissals (user_id);

alter table announcement_dismissals enable row level security;

-- Scalar subselects around auth.uid()/is_admin() per 20260805002000_rls_
-- performance.sql — evaluated once per query instead of once per row.
drop policy if exists "own dismissals" on announcement_dismissals;
create policy "own dismissals" on announcement_dismissals
  for all using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "admins read dismissals" on announcement_dismissals;
create policy "admins read dismissals" on announcement_dismissals
  for select using ((select is_admin()));

-- ── Views (as in "was seen by"), and clicks ──────────────────────────────────
-- announcements.seen_count is a running total with no per-user record behind
-- it, so incrementing on render would count impressions: one teacher who leaves
-- the dashboard open across a free period would read as dozens of people. This
-- table is what makes the number mean "distinct teachers".
--
-- clicked_at lives here rather than in its own table because a click is always
-- preceded by a view, and the pair is always read together.
create table if not exists announcement_views (
  announcement_id uuid not null references announcements(id) on delete cascade,
  user_id         uuid not null references auth.users(id)    on delete cascade,
  seen_at         timestamptz not null default now(),
  clicked_at      timestamptz,
  primary key (announcement_id, user_id)
);

create index if not exists announcement_views_user_idx
  on announcement_views (user_id);

alter table announcement_views enable row level security;

drop policy if exists "own views" on announcement_views;
create policy "own views" on announcement_views
  for all using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "admins read views" on announcement_views;
create policy "admins read views" on announcement_views
  for select using ((select is_admin()));

-- ── Audience-aware RLS ───────────────────────────────────────────────────────
-- The replaced policy checked auth.uid() is not null, live, and the window. An
-- announcement addressed to free-plan teachers was therefore readable by a Pro
-- teacher through the REST API — no UI showed it, but "no UI shows it" is not
-- an access control.
--
-- Enforced here as well as in my_announcements() below, because that function
-- is security definer and so does not itself run under this policy. This is the
-- one that protects the table from a direct PostgREST select.
drop policy if exists "live announcements readable" on announcements;
create policy "live announcements readable" on announcements
  for select using (
    (select auth.uid()) is not null
    and live
    and starts_at <= now()
    and (ends_at is null or ends_at > now())
    and (
      audience = 'everyone'
      or (audience = 'free' and exists (
            select 1 from profiles p
             where p.id = (select auth.uid())
               and coalesce(p.plan, 'free') = 'free'))
      or (audience = 'paying' and exists (
            select 1 from profiles p
             where p.id = (select auth.uid())
               and coalesce(p.plan, 'free') <> 'free'))
      or (audience = 'school' and exists (
            select 1 from profiles p
             where p.id = (select auth.uid())
               and p.school_id is not null))
      or (audience = 'one_school' and exists (
            select 1 from profiles p
             where p.id = (select auth.uid())
               and p.school_id = announcements.school_id))
    )
  );

-- ── my_announcements() ───────────────────────────────────────────────────────
-- What this teacher should see right now: live, in its date window, addressed
-- to them, and not already dismissed. `seen` comes back too so the caller can
-- render an unread state without a second round trip.
--
-- The audience predicate is repeated from the policy above rather than relying
-- on it: security definer bypasses RLS on its own reads, so leaving it out here
-- would return every live announcement to everyone.
create or replace function my_announcements()
returns table (
  id uuid,
  message text,
  type text,
  dismissible boolean,
  starts_at timestamptz,
  seen boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  return query
    select a.id, a.message, a.type, a.dismissible, a.starts_at,
           (v.user_id is not null)
    from announcements a
    left join announcement_views v
      on v.announcement_id = a.id and v.user_id = v_uid
    where a.live
      and a.starts_at <= now()
      and (a.ends_at is null or a.ends_at > now())
      and not exists (
        select 1 from announcement_dismissals d
         where d.announcement_id = a.id and d.user_id = v_uid
      )
      and (
        a.audience = 'everyone'
        or (a.audience = 'free' and exists (
              select 1 from profiles p
               where p.id = v_uid and coalesce(p.plan, 'free') = 'free'))
        or (a.audience = 'paying' and exists (
              select 1 from profiles p
               where p.id = v_uid and coalesce(p.plan, 'free') <> 'free'))
        or (a.audience = 'school' and exists (
              select 1 from profiles p
               where p.id = v_uid and p.school_id is not null))
        or (a.audience = 'one_school' and exists (
              select 1 from profiles p
               where p.id = v_uid and p.school_id = a.school_id))
      )
    -- Maintenance outranks a warning outranks an announcement about a new
    -- feature: the banner shows one at a time, and downtime is the one a
    -- teacher most needs to see.
    order by
      case a.type when 'maintenance' then 0 when 'warning' then 1 else 2 end,
      a.starts_at desc;
end;
$$;
revoke execute on function my_announcements() from anon, public;
grant execute on function my_announcements() to authenticated;

-- Badge count for the sidebar. Deliberately built on my_announcements() rather
-- than repeating the predicate a third time — the two can never disagree about
-- what counts as visible.
create or replace function my_announcements_unread()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(count(*), 0)::integer
  from my_announcements() m
  where not m.seen;
$$;
revoke execute on function my_announcements_unread() from anon, public;
grant execute on function my_announcements_unread() to authenticated;

-- ── Counters ─────────────────────────────────────────────────────────────────
-- Each of these inserts a per-user row first and only bumps the aggregate on
-- announcements when that insert was new. A re-render, a double-fired effect or
-- a teacher refreshing the page therefore cannot inflate the count, which is
-- what lets /admin/announce describe these as people rather than events.

create or replace function announcement_seen(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid(); v_inserted integer;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  insert into announcement_views (announcement_id, user_id)
  values (p_id, v_uid)
  on conflict (announcement_id, user_id) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted > 0 then
    update announcements set seen_count = seen_count + 1 where id = p_id;
  end if;
end;
$$;
revoke execute on function announcement_seen(uuid) from anon, public;
grant execute on function announcement_seen(uuid) to authenticated;

create or replace function announcement_clicked(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid(); v_hit integer;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  -- Upsert: a click can arrive before the view row exists in principle, and the
  -- do-update branch only fires while clicked_at is still null, so a second
  -- click by the same teacher is a no-op.
  insert into announcement_views (announcement_id, user_id, seen_at, clicked_at)
  values (p_id, v_uid, now(), now())
  on conflict (announcement_id, user_id) do update
     set clicked_at = now()
   where announcement_views.clicked_at is null;

  get diagnostics v_hit = row_count;
  if v_hit > 0 then
    update announcements set click_count = click_count + 1 where id = p_id;
  end if;
end;
$$;
revoke execute on function announcement_clicked(uuid) from anon, public;
grant execute on function announcement_clicked(uuid) to authenticated;

create or replace function announcement_dismiss(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid(); v_inserted integer; v_dismissible boolean;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  -- An announcement marked non-dismissible must not be dismissable through the
  -- API either. The admin unticked that box because the message has to be read;
  -- hiding the × in the UI is presentation, this is the actual rule.
  select dismissible into v_dismissible from announcements where id = p_id;
  if v_dismissible is null then raise exception 'no such announcement'; end if;
  if not v_dismissible then raise exception 'this announcement cannot be dismissed'; end if;

  insert into announcement_dismissals (announcement_id, user_id)
  values (p_id, v_uid)
  on conflict (announcement_id, user_id) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted > 0 then
    update announcements set dismissed_count = dismissed_count + 1 where id = p_id;
  end if;
end;
$$;
revoke execute on function announcement_dismiss(uuid) from anon, public;
grant execute on function announcement_dismiss(uuid) to authenticated;

-- ── admin_upsert_announcement: two fixes ─────────────────────────────────────
-- 1. The update branch omitted starts_at entirely, so a scheduled announcement
--    was stuck with whatever date it was created with — the compose form did
--    not expose the field either, so this was invisible until now.
-- 2. ends_at used coalesce, which cannot distinguish "leave it alone" from
--    "clear it". Once an end date was set, "show it until I take it down"
--    became unreachable. Both now use `payload ? 'key'` so an explicit null
--    clears and an absent key leaves the column untouched.
create or replace function admin_upsert_announcement(payload jsonb)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  v_id := nullif(payload->>'id', '')::uuid;

  if v_id is null then
    insert into announcements (message, type, audience, school_id, dismissible,
                               starts_at, ends_at, live, created_by)
    values (
      payload->>'message',
      coalesce(nullif(payload->>'type', ''), 'info'),
      coalesce(nullif(payload->>'audience', ''), 'everyone'),
      nullif(payload->>'school_id', '')::uuid,
      coalesce((payload->>'dismissible')::boolean, true),
      coalesce(nullif(payload->>'starts_at', '')::timestamptz, now()),
      nullif(payload->>'ends_at', '')::timestamptz,
      coalesce((payload->>'live')::boolean, false),
      auth.uid()
    )
    returning id into v_id;

    perform admin_log('Created announcement', 'content', 'announcement', v_id::text,
      left(payload->>'message', 60), payload);
  else
    update announcements set
      message     = coalesce(nullif(payload->>'message', ''), message),
      type        = coalesce(nullif(payload->>'type', ''), type),
      audience    = coalesce(nullif(payload->>'audience', ''), audience),
      school_id   = case when payload ? 'school_id'
                         then nullif(payload->>'school_id', '')::uuid
                         else school_id end,
      dismissible = coalesce((payload->>'dismissible')::boolean, dismissible),
      starts_at   = coalesce(nullif(payload->>'starts_at', '')::timestamptz, starts_at),
      ends_at     = case when payload ? 'ends_at'
                         then nullif(payload->>'ends_at', '')::timestamptz
                         else ends_at end,
      live        = coalesce((payload->>'live')::boolean, live)
    where id = v_id;

    perform admin_log('Updated announcement', 'content', 'announcement', v_id::text,
      left(coalesce(payload->>'message', ''), 60), payload);
  end if;

  return v_id;
end;
$$;
revoke execute on function admin_upsert_announcement(jsonb) from anon, public;
grant execute on function admin_upsert_announcement(jsonb) to authenticated;
