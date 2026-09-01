-- ── Folders ──────────────────────────────────────────────────────────────────
--
-- The Library has shipped since the V2 rebuild showing one folder per TOOL,
-- derived in the browser by grouping tool_runs.tool_slug. Nothing could be
-- created, named, coloured or moved, because there was nowhere to record any of
-- it. This is that record, and it is the model the developer handover specifies:
-- Folder { id, userId, name, colour } with Resource.folderId nullable.
--
-- WHAT IS AND IS NOT IN THE DATABASE
--
-- Folders are FLAT. There is no parent_id and no nesting. The handover's data
-- model has none, the prototype has none, and a teacher filing this term's
-- resources does not need a tree. Nesting is easy to add later and impossible
-- to remove once people have built hierarchies inside it.
--
-- There is no `position` column. Folders sort by name in the client. A manual
-- order needs drag-to-reorder to set it, which the prototype does not have, and
-- a column nothing can write is worse than no column.
--
-- There is no `unfiled` row. "Unfiled" is folder_id IS NULL, rendered as a
-- permanent virtual card. A real row would have to be created for every user,
-- protected from deletion and renaming, and kept in step on signup. The absence
-- of a value already means exactly what the card means.
--
-- Unlike user_badges (20260901000000), this table IS browser-writable through
-- RLS rather than going through a security definer function. That decision is
-- deliberate and the reasoning does not carry over: a badge is the progression
-- system and forging one devalues it for everybody, whereas a folder is one
-- teacher's own filing and is worth nothing to anyone else. There is no
-- privilege here to escalate to.

-- The allowed colour keys.
--
-- KEEP IN STEP WITH `FOLDER_COLOURS` in app/lib/folders.ts, which owns the
-- actual tints, solids and display names. This is only the whitelist that stops
-- a hand-rolled insert writing colour = 'chartreuse' and leaving a folder the
-- palette cannot render. Same arrangement as known_badge_ids() and badges.ts,
-- for the same reason: one source of truth for the content, a flat list here
-- for the constraint.
--
-- Five hues, each in a light and a deep variant. The light variants are the
-- five swatches in the prototype's New folder modal; the deep ones exist
-- because five was not enough to tell a term's worth of folders apart.
create or replace function folder_colours()
returns text[]
language sql
immutable
set search_path = public
as $$
  select array[
    'violet', 'violet-deep',
    'blue',   'blue-deep',
    'green',  'green-deep',
    'amber',  'amber-deep',
    'pink',   'pink-deep'
  ];
$$;

revoke all on function folder_colours() from public, anon;
grant execute on function folder_colours() to authenticated;


create table if not exists folders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  -- Trimmed length, so a name of nothing but spaces cannot pass. 60 is what
  -- fits a folder card at the narrowest grid track without the name being
  -- ellipsised into uselessness.
  name       text not null check (length(btrim(name)) between 1 and 60),
  colour     text not null default 'violet' check (colour = any (folder_colours())),
  created_at timestamptz not null default now()
);

alter table folders enable row level security;

create index if not exists folders_user_idx on folders (user_id, created_at);

-- `(select auth.uid())` rather than a bare call: see 20260805002000, Postgres
-- otherwise re-evaluates it once per row.
create policy "own folders read"
  on folders for select using ((select auth.uid()) = user_id);

create policy "own folders insert"
  on folders for insert with check ((select auth.uid()) = user_id);

create policy "own folders update"
  on folders for update
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

create policy "own folders delete"
  on folders for delete using ((select auth.uid()) = user_id);

grant select, insert, update, delete on folders to authenticated;


-- ── Filing a resource ────────────────────────────────────────────────────────
--
-- `on delete set null` is load bearing. Deleting a folder must never delete the
-- resources inside it: they cost credits to generate, and a teacher clearing out
-- last term's folders is tidying, not discarding. They fall back to Unfiled,
-- which is what the delete confirmation promises.
alter table tool_runs
  add column if not exists folder_id uuid
    references folders (id) on delete set null;

-- Mirrors tool_runs_user_tool_idx, for the same query shape with folder_id in
-- place of tool_slug: the Library lists one folder's resources, newest first.
create index if not exists tool_runs_folder_idx
  on tool_runs (user_id, folder_id, created_at desc);


-- The first UPDATE path onto tool_runs. The table has carried select, insert
-- and delete policies since 20260531000000 and nothing has ever needed to
-- modify a row, because a generation is a historical fact.
--
-- Filing is the exception: folder_id is not part of what was generated, it is
-- where the teacher decided to put it afterwards. The policy is scoped to rows
-- the teacher already owns on both sides, so it grants exactly one new ability,
-- moving your own resource between your own folders, and cannot be used to
-- reach anybody else's history.
--
-- Postgres has no column-level RLS, so this technically also permits rewriting
-- output or input on a row you own. That is not a privilege boundary: it is
-- your own resource, and you can already delete it outright.
create policy "own runs update"
  on tool_runs for update
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

-- The table grant already includes update (20260813080000_restore_table_grants),
-- so there is nothing to add here. Stated rather than left implicit, because the
-- policy above is inert without it and the two live in different files.
