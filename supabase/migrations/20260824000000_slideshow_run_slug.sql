-- The Slideshow editor recorded its runs under the API route slug
-- ("generate-slideshow") rather than the tool's own slug ("slideshow"). /folders
-- resolves a run to the TOOLS registry by matching `/tools/<tool_slug>`, so the
-- route name never matched: the folder rendered with the raw slug as its name,
-- no icon, and no working "Open tool" button.
--
-- app/components/editor/Editor.tsx now writes "slideshow"; this realigns the
-- rows that were already stored.
--
-- Scope note: only the display slug on tool_runs moves. Cost and usage tracking
-- (asset_cost, slide_cost, the /admin/usage umbrella row) legitimately keys on
-- the route name "generate-slideshow" and is deliberately left alone.

update public.tool_runs
   set tool_slug = 'slideshow'
 where tool_slug = 'generate-slideshow';
