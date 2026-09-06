-- ── Is a Storage object still in use? ────────────────────────────────────────
--
-- Deleting a resource now reclaims the Storage objects it owned (see
-- app/api/resources/delete). It must never reclaim one that something ELSE
-- still points at, and on real data that is the common case rather than the
-- corner: measured on staging, 261 of the 383 images in the reuse library — 68%
-- of it — are also referenced by a deck.
--
-- WHY A FUNCTION RATHER THAN QUERIES FROM THE ROUTE
--
-- Two of the five places a reference can live are jsonb (`tool_runs.input`,
-- `presentations.slides`), and PostgREST cannot LIKE against jsonb at all:
--
--   .like('slides::text', '%file.png%')  ->  operator does not exist: jsonb ~~ unknown
--
-- Worse, that error is INVISIBLE through a `head: true` count — the count comes
-- back null rather than raising, which reads exactly like "no references found"
-- and would delete a file that is still on a slide. Doing the whole check in
-- SQL removes the cast problem and turns a silent wrong answer into a real
-- error the caller can see.
--
-- It is also one round trip for a whole deck's worth of files instead of five
-- per file.

-- Which of these object paths is still referenced by anything?
--
-- Takes paths (not full URLs) because the same file is stored two ways: the
-- plain public URL, and the /render/image/ transform toThumbnailUrl() writes.
-- Both contain the path, so one match catches either.
--
-- `p_exclude_id` is the resource being deleted. Its row is normally already
-- gone by the time this runs; passing it keeps the answer correct if a caller
-- ever checks first and deletes after.
create or replace function storage_paths_in_use(
  p_paths      text[],
  p_exclude_id uuid default null
)
returns table (path text)
language sql
stable
security definer
set search_path = public
as $$
  select p.path
  from unnest(p_paths) as p(path)
  where
    -- The cross-slideshow reuse library. An image here is re-insertable into
    -- any deck from the picker, so it is never one resource's property.
    exists (
      select 1 from generated_images g
       where g.data_url like '%' || p.path || '%'
    )
    or exists (
      select 1 from presentations pr
       where pr.slides::text like '%' || p.path || '%'
         and (p_exclude_id is null or pr.id <> p_exclude_id)
    )
    or exists (
      select 1 from tool_runs t
       where (t.output like '%' || p.path || '%'
              or t.input::text like '%' || p.path || '%')
         and (p_exclude_id is null or t.id <> p_exclude_id)
    )
    -- A share COPIES the sender's output as a snapshot (20260904000000), so a
    -- recipient's feed can outlive the original by design. The sender deleting
    -- their copy must not break the images in somebody else's library.
    or exists (
      select 1 from shares s
       where s.output like '%' || p.path || '%'
    );
$$;

-- Service role only. This reads across every user's rows by design — that is
-- the whole point, since the referent may belong to somebody else — so it must
-- never be reachable from a browser session. The delete route calls it with the
-- service key, which bypasses RLS and does not need a grant.
revoke all on function storage_paths_in_use(text[], uuid) from public, anon, authenticated;

comment on function storage_paths_in_use(text[], uuid) is
  'Which of the given Storage object paths are still referenced by a deck, run, share or the image library. Used by the delete route to avoid reclaiming a file that is still in use. Service role only: deliberately reads across all users.';
