-- ── One run row per generation ───────────────────────────────────────────────
--
-- A deck is recorded when its stream completes AND when the editor unmounts,
-- because a teacher who starts a second deck before the first finishes aborts
-- the stream — "complete" never arrives, and without the unmount path that
-- deck's cost rows would be orphaned and it would vanish from the activity log.
--
-- The in-memory guard against double-recording only holds within one mount.
-- Remounting the same presentation (navigating back to it, a fast refresh, a
-- second tab) resets it, and the deck gets logged twice. Observed in practice:
-- run 1bd3c3cd was inserted at 14:08:51 and again at 14:09:45.
--
-- Uniqueness on run_id makes that impossible regardless of how the client
-- behaves. The second insert now fails with 23505, which saveToolRun's caller
-- already treats as a non-fatal warning.
--
-- Partial, because every historical row has run_id = null and there are many of
-- them; nulls are not distinct in a plain unique index only from PG15, and this
-- is clearer about the intent either way.

-- Collapse any duplicates already recorded, keeping the earliest — it is the
-- one written when generation actually finished.
delete from tool_runs t
using tool_runs keep
where t.run_id is not null
  and t.run_id = keep.run_id
  and t.created_at > keep.created_at;

create unique index if not exists tool_runs_run_id_key
  on tool_runs (run_id) where run_id is not null;
