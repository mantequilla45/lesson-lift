-- Profile photos.
--
-- Two parts: the column that remembers which photo is yours, and the bucket the
-- bytes live in.

-- ── 1. profiles.avatar_url ──────────────────────────────────────────────────
--
-- Holds the public Storage URL, not the object path, so <img src> can use it
-- directly and non-Storage URLs (a future OAuth avatar from Google, say) fit the
-- same column without a second code path.
--
-- No change is needed to profiles_guard_privileged_columns_trg. That trigger is
-- an explicit DENY-list — it raises on is_admin, plan, subscription_status,
-- stripe_*, current_period_end, school_id and suspended_* — so a new column is
-- self-editable by default, which is what we want here.
--
-- NOTE for whoever reads that trigger next: its comment says the columns a user
-- legitimately edits are "their own name, phone and country". That list is now
-- one short — avatar_url joins it.
alter table profiles add column if not exists avatar_url text;

comment on column profiles.avatar_url is
  'Public Storage URL of the teacher''s profile photo. Null means render the initials placeholder.';

-- ── 2. The avatars bucket ───────────────────────────────────────────────────
--
-- Public read so the browser streams the image straight from the CDN, the same
-- reason the `images` bucket is public.
--
-- Writes are DELIBERATELY tighter than that bucket's. 20260521000100 grants
-- insert/delete to anon with a "tighten once auth is in" note; auth is in, and
-- there is no reason for a new bucket to inherit the placeholder policy. Here,
-- writes require `authenticated` AND the object must sit in a folder named after
-- the caller's uid, so one teacher cannot overwrite or delete another's photo.
--
-- Object path: <user_id>/<timestamp>.<ext> — the uid-prefixed folder is what
-- makes the foldername() predicate below work.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "public read avatars" on storage.objects;
create policy "public read avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "own folder insert avatars" on storage.objects;
create policy "own folder insert avatars"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- upsert:true on the client issues an UPDATE when the object already exists, so
-- without this an overwrite fails even inside the caller's own folder.
drop policy if exists "own folder update avatars" on storage.objects;
create policy "own folder update avatars"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "own folder delete avatars" on storage.objects;
create policy "own folder delete avatars"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
