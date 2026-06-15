-- Persist the generation params (topic, instructions, toggles, theme, etc.) used
-- to create a slideshow, so the editor's "Edit" button can reopen the prompt and
-- regenerate the deck later (sessionStorage is wiped after the first read).
alter table presentations add column if not exists generation_params jsonb;
