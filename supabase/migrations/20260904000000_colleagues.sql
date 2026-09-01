-- ── Colleagues and sharing ───────────────────────────────────────────────────
--
-- The last unbuilt screen in the sidebar. Colleagues has rendered as a disabled
-- "Soon" row since the V2 rebuild, the Library's row menu has carried an inert
-- "Share with colleagues" item, and ten badges in app/lib/badges.ts have been
-- pending on a shares table that did not exist. This is that table, plus the
-- connection model underneath it.
--
-- The handover's data model is Colleague { userId, colleagueId, status } and
-- Share { resourceId, fromUserId, toUserId, savedAt? }. What follows is that,
-- with the status split into its own table for the reason given below.
--
-- WHAT IS AND IS NOT IN THE DATABASE
--
-- A connection is TWO ROWS in colleague_edges, one per direction, not one row
-- with an ordering rule. Every read this feature makes is "who are my
-- colleagues": colleague_stats does it, the shares insert policy does it, the
-- page does it on load. With a single row and a least/greatest convention each
-- of those becomes a two-branch OR that no index serves well, and the ordering
-- rule ends up restated in six places. Two rows makes all of them a single
-- equality on the primary key. The pair is written atomically by
-- accept_colleague_request() and nothing else writes there, which is what keeps
-- the two halves in step.
--
-- colleague_edges has NO INSERT POLICY. This is the security boundary of the
-- whole feature and it is worth being blunt about: an edge is what authorises
-- reading another teacher's statistics and writing into their share feed. A
-- self-granted edge is not a cosmetic forgery like a badge, it is a complete
-- authorisation bypass, available from the browser console with the anon key
-- that ships in the client bundle:
--
--   await supabase.from('colleague_edges').insert({ user_id: me, other_id: anyone })
--
-- Acceptance therefore goes through a security definer function that checks the
-- request was addressed to the caller. See 20260811000400 for the precedent and
-- for what happens when a user-writable row turns out to grant something.
--
-- A share carries a SNAPSHOT of the resource, not a reference to it. The
-- handover is explicit that the model is copy, not link, and a copy is taken at
-- the moment it is made. Referencing the sender's tool_runs row would mean the
-- sender editing or deleting their resource silently changes or destroys what
-- the recipient was already offered. It would also make the recipient's feed
-- unreadable without a definer function, because RLS on tool_runs is own-rows
-- only and must stay that way. With a snapshot, the feed is a plain select and
-- the whole share flow contains no definer function at all.
--
-- The copy into the recipient's library happens when THEY press Save to
-- library, not when the sender shares. The prototype's feed row has that button
-- and it has to mean something. It is also the only version where nothing
-- enters a teacher's library unasked: a resource copied in on someone else's
-- initiative would count toward that teacher's own resource total and their
-- streak, which are the numbers this same feature puts on display.
--
-- There is no streak column and no cached stats table. colleague_stats returns
-- the EVIDENCE (distinct active days, a per-tool histogram) and the four
-- headline numbers are derived in TypeScript by the same functions that derive
-- them for the teacher's own dashboard. The streak rule (Europe/London,
-- weekends skipped, one weekday forgiven) is forty justified lines in
-- app/lib/badgeCriteria.ts and TOOL_MINUTES_SAVED in app/lib/tools.ts is
-- sourced arithmetic that will be revised. Restating either here would be a
-- second copy of a rule that moves, and the first symptom of drift would be a
-- colleague's row disagreeing with what that colleague sees on their own Today.
-- This is the same over-approximation move claim_badges (20260901000000)
-- already makes and documents.
--
-- ON SECURITY DEFINER FOR A READ
--
-- The rule this codebase has followed is: a definer function when forging a row
-- would harm others or escalate privilege, plain RLS when the data is one
-- teacher's own and worthless to anyone else. That rule is about writes, and
-- two functions here are reads of another teacher's data, so they need their
-- own justification.
--
-- RLS can express "my own rows" and nothing else. There is no way to write a
-- tool_runs policy meaning "readable by someone I have an accepted edge to"
-- that does not also expose title, input and output, which are the resource
-- bodies. A definer function returning only counts and dates is strictly
-- narrower than any policy that would satisfy the same screen. The same holds
-- for find_colleagues: profiles is select-own-row-only, email is not on
-- profiles at all, and the alternative is a policy making every profile
-- readable by everyone.
--
-- The cost is that inside a definer function there is NO RLS BACKSTOP. Whatever
-- the function selects, the caller receives. Both functions below are therefore
-- built around a single filtering join, and that join is the entire control.


-- ── Usernames ────────────────────────────────────────────────────────────────
--
-- Search is by name, username or email, which the prototype's placeholder and
-- the landing page FAQ both promise. profiles has carried neither a username
-- nor an email: email lives on auth.users (which is why existing_member_emails
-- had to be a definer function joining it) and a username has never existed.
--
-- Nullable, and it stays nullable. Every existing row has no username, and the
-- alternatives are inventing one from a name (which collides, and hands people
-- a public handle they did not choose) or blocking the migration on a backfill.
-- A teacher without one is still findable by email and by invite link.
--
-- No change is needed to the guard trigger from 20260811000400. That trigger is
-- a DENY list of privileged columns, so a new column is self-editable by
-- default, which is what a username should be. Same note as 20260827000000 made
-- for avatar_url.
alter table profiles add column if not exists username text;

-- Case insensitive uniqueness, and only over rows that have one. Without
-- lower(), "SarahM" and "sarahm" are two accounts that render identically
-- everywhere in the interface.
create unique index if not exists profiles_username_key
  on profiles (lower(username)) where username is not null;

-- Lowercase, digits and underscore only. Three characters is the floor the
-- search enforces, so a shorter username would be unfindable by the search that
-- exists to find it. Twenty is what fits the row meta line without ellipsis.
-- The shape is checked here as well as in the client because this is the value
-- other teachers type at each other, and a handle with a trailing space or a
-- lookalike character is a way to be mistaken for somebody else.
do $$
begin
  alter table profiles add constraint profiles_username_shape
    check (username is null or username ~ '^[a-z0-9_]{3,20}$');
exception
  when duplicate_object then null;
end
$$;


-- ── Requests ─────────────────────────────────────────────────────────────────
--
-- Ordinary RLS. A request is directional, it grants nothing on its own, and
-- both parties need to be able to withdraw or decline it. The only privileged
-- step is acceptance, which is the function below.
create table if not exists colleague_requests (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  recipient_id uuid not null references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now(),

  -- One pending request per direction. A double click, or a second attempt
  -- after the first appeared to do nothing, must not queue two rows for the
  -- recipient to decline separately.
  constraint colleague_requests_pair unique (sender_id, recipient_id),
  constraint colleague_requests_not_self check (sender_id <> recipient_id)
);

alter table colleague_requests enable row level security;

create index if not exists colleague_requests_recipient_idx
  on colleague_requests (recipient_id, created_at desc);

-- Both parties read: the recipient needs their incoming list, the sender needs
-- to know a request is still pending so the button reads Pending rather than
-- offering to send another.
create policy "colleague request read"
  on colleague_requests for select
    using ((select auth.uid()) in (sender_id, recipient_id));

create policy "colleague request insert"
  on colleague_requests for insert
    with check ((select auth.uid()) = sender_id);

-- Either party: the sender withdrawing, the recipient declining. A decline is a
-- delete rather than a status, because a declined request that lingers is a
-- record of a refusal, and nobody needs to be able to read that back.
create policy "colleague request delete"
  on colleague_requests for delete
    using ((select auth.uid()) in (sender_id, recipient_id));

grant select, insert, delete on colleague_requests to authenticated;


-- ── Connections ──────────────────────────────────────────────────────────────
--
-- See the header: two rows per connection, and deliberately no insert policy.
-- Both columns reference auth.users, not profiles.
--
-- Pointing them at profiles would let PostgREST embed a name in the same query,
-- but only for rows the CALLER can already read, and profiles is
-- own-row-only. The names come from colleague_profiles() above instead. See
-- that function for why the read policy it would have needed was rejected.
create table if not exists colleague_edges (
  user_id    uuid not null references auth.users (id) on delete cascade,
  other_id   uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, other_id),
  constraint colleague_edges_not_self check (user_id <> other_id)
);

alter table colleague_edges enable row level security;

create policy "own edges read"
  on colleague_edges for select using ((select auth.uid()) = user_id);

-- Removing a colleague. Deletes one direction; the client deletes both, and a
-- half-removed pair is harmless in a way a half-created one is not: the
-- remaining edge only grants the OTHER person access, which is the safe
-- direction to fail in.
create policy "own edges delete"
  on colleague_edges for delete using ((select auth.uid()) = user_id);

-- No insert. See the header.
grant select, delete on colleague_edges to authenticated;


-- ── Reading a colleague's name and face ──────────────────────────────────────
--
-- `profiles` stays SELECT-OWN-ROW-ONLY, as it has been since 20260530000000.
-- Nothing in this migration widens it, and this comment exists to say why the
-- obvious alternative was rejected.
--
-- A colleague list has to put a name and a photo next to each row, so the four
-- display columns of another teacher's profile have to become readable
-- somehow. The tempting version is an additional permissive policy: "readable
-- if we have an accepted edge". It is one statement, it makes PostgREST embeds
-- work, and it is WRONG, because Postgres has no column-level RLS. A policy
-- grants the whole row or none of it, and that row carries:
--
--   phone, dial_code, country          the teacher's personal contact details
--   plan, subscription_status,
--   stripe_customer_id,
--   current_period_end                 their billing state
--   suspended_at, suspended_reason,
--   suspended_by                       moderation history
--   is_admin, school_id
--
-- None of that appears anywhere in this feature, and a teacher agreeing to
-- connect with a colleague is plainly not agreeing to hand over their phone
-- number and whether their card has failed. One line in a browser console
-- would read the lot:
--
--   await supabase.from('profiles').select('*').eq('id', colleagueId)
--
-- So the four columns are served by a definer function that returns those four
-- columns and nothing else. Adding a private column to profiles later is then
-- safe by default, which the policy version would not have been: it would have
-- leaked the new column silently, with no diff to notice.
create or replace function colleague_profiles(colleague_ids uuid[])
returns table (
  user_id    uuid,
  first_name text,
  surname    text,
  username   text,
  avatar_url text
)
language plpgsql
stable
security definer
set search_path = public
as $$
-- Every output parameter is also a column on profiles.
#variable_conflict use_column
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if colleague_ids is null or array_length(colleague_ids, 1) is null then
    return;
  end if;

  if array_length(colleague_ids, 1) > 200 then
    raise exception 'too many profiles requested at once';
  end if;

  return query
  select p.id, p.first_name, p.surname, p.username, p.avatar_url
    from profiles p
   where p.id = any (colleague_ids)
     -- The authorisation, and it is the only thing standing between a caller
     -- and any profile in the table: there is no RLS backstop inside a definer
     -- function. Connected, or a request pending in either direction. A
     -- stranger's id returns no row, exactly as an id that does not exist does.
     and (
       exists (
         select 1 from colleague_edges e
          where e.user_id = uid and e.other_id = p.id
       )
       or exists (
         select 1 from colleague_requests r
          where (r.sender_id = uid and r.recipient_id = p.id)
             or (r.recipient_id = uid and r.sender_id = p.id)
       )
     );
end;
$$;

revoke all on function colleague_profiles(uuid[]) from public, anon;
grant execute on function colleague_profiles(uuid[]) to authenticated;


-- ── Where two people stand ───────────────────────────────────────────────────
--
-- Returned with every search result so a row can render Add / Pending /
-- Connected without a second round trip and without the client diffing two
-- lists to work it out.
create or replace function colleague_status(a uuid, b uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (select 1 from colleague_edges e
                  where e.user_id = a and e.other_id = b) then 'connected'
    when exists (select 1 from colleague_requests r
                  where r.sender_id = a and r.recipient_id = b) then 'pending_out'
    when exists (select 1 from colleague_requests r
                  where r.sender_id = b and r.recipient_id = a) then 'pending_in'
    else 'none'
  end;
$$;

revoke all on function colleague_status(uuid, uuid) from public, anon;
grant execute on function colleague_status(uuid, uuid) to authenticated;


-- ── Accepting ────────────────────────────────────────────────────────────────
--
-- The only write path into colleague_edges, and the reason that table has no
-- insert policy. Both directions are inserted in one statement so a connection
-- cannot exist one-sidedly: a half-written pair would mean one teacher can read
-- the other's statistics and share into their feed while the reverse is denied,
-- which is worse than either outcome.
create or replace function accept_colleague_request(request_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
  req colleague_requests%rowtype;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select * into req from colleague_requests where id = request_id;

  -- One check, and it is the whole authorisation: only the person a request was
  -- addressed to can accept it. A missing row and someone else's row raise the
  -- same error, so this cannot be used to test whether a request exists.
  if req.id is null or req.recipient_id <> uid then
    raise exception 'no such request';
  end if;

  insert into colleague_edges (user_id, other_id)
  values (req.sender_id, req.recipient_id),
         (req.recipient_id, req.sender_id)
  on conflict (user_id, other_id) do nothing;

  delete from colleague_requests where id = req.id;
end;
$$;

revoke all on function accept_colleague_request(uuid) from public, anon;
grant execute on function accept_colleague_request(uuid) to authenticated;


-- ── Finding people ───────────────────────────────────────────────────────────
--
-- The bounds are the design, so they are stated here rather than left to the
-- caller, which passes only the term.
--
-- EMAIL AND USERNAME MATCH EXACTLY, NEVER BY PREFIX. A prefix search on email
-- turns this function into an address book scraper: 'sarah@' would return every
-- Sarah in the country. Exact match means the searcher already holds the
-- address, which is the same standard as typing it into the To: field of an
-- email. It confirms membership for an address you already have, and that is
-- the irreducible leak of any find-by-email feature.
--
-- NO EMAIL IS EVER RETURNED. You can confirm an address belongs to a Jooma
-- account; you cannot go the other way and recover an address from a name.
--
-- NAME MATCHES BY PREFIX, and this is the loosest branch. "Find a colleague by
-- name" is the promise on the screen and in the landing FAQ, and a name search
-- requiring the exact spelling of a surname is not a name search. Bounded by
-- the three character floor and the row limit. Somebody patient could walk the
-- alphabet and assemble a partial directory of display names, usernames and
-- avatars, which is the accepted cost of a name-searchable staffroom: it is
-- also exactly the data the feature exists to show.
create or replace function find_colleagues(q text)
returns table (
  user_id    uuid,
  first_name text,
  surname    text,
  username   text,
  avatar_url text,
  status     text
)
language plpgsql
stable
security definer
set search_path = public
as $$
-- Every output parameter here (first_name, surname, username, avatar_url) is
-- also a column on profiles. See the note on colleague_stats.
#variable_conflict use_column
declare
  uid  uuid := (select auth.uid());
  term text := lower(btrim(coalesce(q, '')));
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  -- Two characters is not a search, it is an enumeration with extra steps.
  if length(term) < 3 then
    return;
  end if;

  return query
  select p.id,
         p.first_name,
         p.surname,
         p.username,
         p.avatar_url,
         colleague_status(uid, p.id)
    from profiles p
    join auth.users u on u.id = p.id
   where p.id <> uid
     -- A suspended account should not be discoverable. Nobody should be able to
     -- send a request to somebody who cannot answer it.
     and p.suspended_at is null
     and (
       lower(u.email) = term
       or lower(p.username) = term
       or lower(coalesce(p.first_name, '') || ' ' || coalesce(p.surname, '')) like term || '%'
       or lower(coalesce(p.surname, '')) like term || '%'
     )
   -- An exact username match is somebody who was told that handle. It goes
   -- first, ahead of anyone who merely shares a name prefix with it.
   order by (lower(p.username) = term) desc, p.surname, p.first_name
   limit 10;
end;
$$;

revoke all on function find_colleagues(text) from public, anon;
grant execute on function find_colleagues(text) to authenticated;


-- ── A colleague's numbers ────────────────────────────────────────────────────
--
-- Returns evidence, not answers. See the header for why the streak rule and the
-- minutes-per-tool table stay in TypeScript.
--
-- The `allowed` CTE is the entire security control, and inside a definer
-- function there is nothing behind it. An id the caller has no accepted edge to
-- produces no row, and an id that does not exist produces no row, so the two
-- are indistinguishable and this cannot be used to test whether an account
-- exists.
create or replace function colleague_stats(colleague_ids uuid[])
returns table (
  user_id         uuid,
  resources_made  bigint,
  badges_earned   bigint,
  active_day_keys text[],
  slug_counts     jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
-- `user_id` is an output parameter of this function AND a column on
-- colleague_edges, tool_runs and user_badges. Without this, plpgsql resolves the
-- name to the parameter and the joins below silently compare a column to a NULL
-- output variable. Same directive and same reason as existing_member_emails in
-- 20260812000200_invite_tokens.sql.
#variable_conflict use_column
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if colleague_ids is null or array_length(colleague_ids, 1) is null then
    return;
  end if;

  -- Bounded for the same reason claim_badges is: this unnests a client supplied
  -- array. Well above any real staffroom and well below a scrape.
  if array_length(colleague_ids, 1) > 200 then
    raise exception 'too many colleagues requested at once';
  end if;

  return query
  with allowed as (
    select e.other_id
      from colleague_edges e
     where e.user_id = uid
       and e.other_id = any (colleague_ids)
  )
  select a.other_id,
         (select count(*) from tool_runs r where r.user_id = a.other_id),
         (select count(*) from user_badges b where b.user_id = a.other_id),
         -- The day keys, not the streak. Capped at 400 days: a streak cannot
         -- survive a gap, so no day older than the longest possible current
         -- streak can affect the number, and 400 is more than a school year.
         -- This is what stops the array growing without bound for a teacher who
         -- has been here for five years. Unordered; streakFrom takes a Set.
         coalesce((
           select array_agg(distinct to_char(r.created_at at time zone 'Europe/London', 'YYYY-MM-DD'))
             from tool_runs r
            where r.user_id = a.other_id
              and r.created_at > now() - interval '400 days'
         ), array[]::text[]),
         -- A per-tool histogram rather than a minutes total, so minutesSavedFor
         -- in app/lib/tools.ts stays the only place that arithmetic lives.
         -- Mirroring TOOL_MINUTES_SAVED here would be a second copy of a
         -- sourced estimate that will be revised, and a stale copy reports the
         -- wrong hours silently rather than failing.
         coalesce((
           select jsonb_object_agg(t.tool_slug, t.n)
             from (
               select r.tool_slug, count(*) as n
                 from tool_runs r
                where r.user_id = a.other_id
                group by r.tool_slug
             ) t
         ), '{}'::jsonb)
    from allowed a;
end;
$$;

revoke all on function colleague_stats(uuid[]) from public, anon;
grant execute on function colleague_stats(uuid[]) to authenticated;


-- ── Shares ───────────────────────────────────────────────────────────────────
--
-- See the header: a snapshot, offered rather than delivered.
create table if not exists shares (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  recipient_id uuid not null references auth.users (id) on delete cascade,

  -- Where it came from. `on delete set null`, never cascade: the sender
  -- deleting their own copy must not reach into the recipient's feed and
  -- withdraw something already offered. Same reasoning as
  -- timetable_lessons.resource_id. Kept so "you have already shared this" can be
  -- answered; nothing on the render path reads through it.
  source_run_id uuid references tool_runs (id) on delete set null,

  -- The snapshot. These four are why the feed renders with a plain select and
  -- why nothing in this flow reads the sender's tool_runs.
  tool_slug    text not null,
  title        text,
  input        jsonb not null default '{}'::jsonb,
  output       text not null,

  created_at   timestamptz not null default now(),

  -- Null until the recipient saves it, and that is the whole state machine: an
  -- unsaved share is an offer, a saved one is a receipt. Nothing is deleted on
  -- save, so "shared five, saved three" stays answerable and the `received`
  -- badge has evidence.
  saved_at     timestamptz,
  saved_run_id uuid references tool_runs (id) on delete set null,

  -- One offer per resource per colleague. A double click, a StrictMode double
  -- mount, or re-sharing the same thing cannot produce two feed rows. Idempotent
  -- by constraint rather than by care, same as timetable_lessons_slot_idx.
  constraint shares_once unique (sender_id, recipient_id, source_run_id)
);

alter table shares enable row level security;

create index if not exists shares_recipient_idx on shares (recipient_id, created_at desc);
create index if not exists shares_sender_idx on shares (sender_id, created_at desc);

-- Both sides read: the recipient needs their feed, the sender needs their own
-- share counts for the badges below.
create policy "share read"
  on shares for select
    using ((select auth.uid()) in (sender_id, recipient_id));

-- The second clause is load bearing. Without it this table is an unsolicited
-- message channel: any authenticated user could push arbitrary text into any
-- stranger's feed, and the feed renders that text.
create policy "share insert"
  on shares for insert
    with check (
      (select auth.uid()) = sender_id
      and exists (
        select 1 from colleague_edges e
         where e.user_id = (select auth.uid())
           and e.other_id = recipient_id
      )
    );

-- The recipient's only, and it is how a share is marked saved. No sender
-- clause: once offered, the sender must not be able to rewrite what is sitting
-- in somebody else's feed.
create policy "share update"
  on shares for update
    using ((select auth.uid()) = recipient_id)
    with check ((select auth.uid()) = recipient_id);

create policy "share delete"
  on shares for delete
    using ((select auth.uid()) in (sender_id, recipient_id));

grant select, insert, update, delete on shares to authenticated;


-- Postgres has no column-level RLS, so the update policy above permits the
-- recipient to rewrite the snapshot, the sender id and the source run as well
-- as stamping saved_at. That harms nobody else's data, but it does corrupt the
-- sender's evidence for the share badges, which count rows the sender wrote.
--
-- A deny-list trigger in the spirit of 20260811000400: only the two columns the
-- save flow needs may move.
create or replace function shares_guard_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service role, and anything running without a session, is trusted.
  if auth.uid() is null then
    return new;
  end if;

  if new.sender_id     is distinct from old.sender_id
     or new.recipient_id  is distinct from old.recipient_id
     or new.source_run_id is distinct from old.source_run_id
     or new.tool_slug     is distinct from old.tool_slug
     or new.title         is distinct from old.title
     or new.input         is distinct from old.input
     or new.output        is distinct from old.output
     or new.created_at    is distinct from old.created_at then
    raise exception 'not authorized: only saved_at and saved_run_id can be changed here';
  end if;

  return new;
end;
$$;

drop trigger if exists shares_guard_update_trg on shares;
create trigger shares_guard_update_trg
  before update on shares
  for each row execute function shares_guard_update();


-- ── Server-side floors for the share badges ──────────────────────────────────
--
-- Six badges stop being pending with this migration (see app/lib/badges.ts).
-- Four of them are qualitative or single-event and stay client trusted, on the
-- reasoning set out in 20260901000000. The two volume ones get a floor here,
-- for the same reason the resource-count badges have one: they are the
-- impressive ones, and a row in `shares` is something the client cannot fake
-- because the insert policy requires an accepted edge on the other side.
--
-- Adding a parameter makes a NEW SIGNATURE rather than replacing the old one,
-- so the four-argument version from 20260901000000 would otherwise survive
-- alongside this. Two overloads is how the old floors quietly keep applying
-- after the new ones are written, so it is dropped at the end of this file:
-- after the new claim_badges below is in place, because until then the existing
-- claim_badges still calls it.
create or replace function badge_gate_ok(
  id text,
  run_count int,
  distinct_tools int,
  distinct_days int,
  share_count int default 0
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select case id
    when 'ten-resources'  then run_count >= 10
    when 'twenty-five'    then run_count >= 25
    when 'fifty-made'     then run_count >= 50
    when 'hundred'        then run_count >= 100
    when 'two-hundred'    then run_count >= 200
    when 'five-hundred'   then run_count >= 500
    when 'library-fifty'  then run_count >= 50
    when 'three-tools'    then distinct_tools >= 3
    when 'five-tools'     then distinct_tools >= 5
    when 'all-tools'      then distinct_tools >= 35
    when 'streak-3'       then distinct_days >= 3
    when 'streak-7'       then distinct_days >= 7
    when 'streak-30'      then distinct_days >= 30
    when 'streak-100'     then distinct_days >= 100
    when 'shared-twenty'  then share_count >= 20
    when 'hundred-shares' then share_count >= 100
    -- Anything not named above has no cheap server-side proxy and passes.
    else true
  end;
$$;

revoke all on function badge_gate_ok(text, int, int, int, int) from public, anon;
grant execute on function badge_gate_ok(text, int, int, int, int) to authenticated;


-- Re-declared from 20260901000000 to count shares alongside the tool_runs pass.
-- Everything else is unchanged, including the hundred-id cap and the reasoning
-- behind it.
create or replace function claim_badges(candidate_ids text[])
returns setof text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
  run_count int;
  distinct_tools int;
  distinct_days int;
  share_count int;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if candidate_ids is null or array_length(candidate_ids, 1) is null then
    return;
  end if;

  if array_length(candidate_ids, 1) > 100 then
    raise exception 'too many badges claimed at once';
  end if;

  select count(*),
         count(distinct tool_slug),
         count(distinct (created_at at time zone 'Europe/London')::date)
    into run_count, distinct_tools, distinct_days
    from tool_runs
   where user_id = uid;

  select count(*) into share_count from shares where sender_id = uid;

  return query
  insert into user_badges (user_id, badge_id)
  select uid, candidate
    from unnest(candidate_ids) as candidate
   where candidate = any (known_badge_ids())
     and badge_gate_ok(candidate, run_count, distinct_tools, distinct_days, share_count)
  on conflict (user_id, badge_id) do nothing
  returning badge_id;
end;
$$;

revoke all on function claim_badges(text[]) from public, anon;
grant execute on function claim_badges(text[]) to authenticated;


-- The old four-argument badge_gate_ok, now that nothing calls it.
--
-- Last, deliberately. Dropping it before the claim_badges above was redefined
-- would leave a window where the live claim_badges called a function that no
-- longer existed, and every badge claim in that window would fail.
--
-- Nothing is lost: the five-argument version defaults share_count to 0, so it
-- answers every question the old one did, identically, for every badge that
-- does not measure sharing.
drop function if exists badge_gate_ok(text, int, int, int);
