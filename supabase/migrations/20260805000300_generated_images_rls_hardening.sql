-- ── generated_images: close the destructive hole ─────────────────────────────
-- These four policies are the last of the pre-auth MVP's `using (true)` grants.
-- Migration 20260601000000 tightened `presentations` but never came back for
-- this table, so today ANY caller — including a signed-out one — can update or
-- delete ANY row in the shared image library.
--
-- Deliberately NOT owner-scoping SELECT. This table is a reuse cache: the app
-- looks up an existing image by prompt/embedding before paying to generate a
-- new one, and it does so through a session-less client (app/lib/supabase.ts),
-- which is why all 374 existing rows have user_id IS NULL. Scoping reads to the
-- owner would empty the cache for everyone and silently multiply image spend —
-- the exact cost line this console exists to control.
--
-- So: reads stay shared (it is generated stock artwork, not teacher content),
-- writes stay open because the ingest path is session-less, but UPDATE and
-- DELETE become admin-only. That removes the vandalism//data-loss vector
-- without breaking the cache.
--
-- FOLLOW-UP (not done here — it needs an app change, not just a policy): move
-- image ingest onto the authenticated server client so user_id is populated,
-- then revisit whether writes can be scoped too.

-- Destructive operations: admins only.
drop policy if exists "anon update" on generated_images;
create policy "admins update images" on generated_images
  for update using (is_admin()) with check (is_admin());

drop policy if exists "anon delete" on generated_images;
create policy "admins delete images" on generated_images
  for delete using (is_admin());

-- Read and insert stay open, but rename them so the intent is explicit rather
-- than looking like leftover scaffolding the next person should "clean up".
drop policy if exists "anon read" on generated_images;
create policy "shared image cache is readable" on generated_images
  for select using (true);

drop policy if exists "anon insert" on generated_images;
create policy "image cache accepts writes" on generated_images
  for insert with check (true);
