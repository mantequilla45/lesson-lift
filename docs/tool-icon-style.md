# Tool icon style guide

The recipe every icon in `public/icons/v2/` follows. Consistency of *recipe* is what keeps the
set coherent; the **glyph** is what makes each tool unique.

## Why the old set was replaced

Every icon in `public/icons/` used the same construction: a 40×40 tile filled with `#F1EFE3` —
the same cream as the page background, so the tile read as invisible — wrapping a single 1px
line-art glyph. Stroke colours varied per icon, but a 1px outline at 40px carries almost no
colour mass, so the variation never registered. Twelve of the 35 glyphs were variations on "a
rectangle with lines in it", and two pairs were literally the same file.

## Canvas

```
viewBox="0 0 48 48"
```

48 rather than 40 gives room for filled detail. Render size is unchanged — every call site sets
its own `w-*`/`h-*`.

## Safe area — the most important rule

**The glyph lives inside a 32×32 box, centred on the 48×48 tile.** That leaves an 8px margin on
every side. Nothing but the long shadow may enter that margin.

```
0        8                    40       48
|--------|---------------------|--------|
         |  glyph lives here   |
         |     (32 × 32)       |
```

An earlier revision let glyphs run edge-to-edge. It made every icon look zoomed in and cropped, and
it destroyed the calm the tile is supposed to provide. If a glyph feels too small inside 32×32, the
answer is to *simplify the glyph*, never to enlarge it past the safe area.

Practical bounds: no element above `y=8` or below `y=40`, left of `x=8` or right of `x=40`. A
deliberate accent may break the margin — an arrow flight, a pencil tip — but only one per icon and
never the primary form.

## Layer order

1. **Tile** — `<rect width="48" height="48" rx="12">`, filled with the tool's category colour.
2. **Long shadow** — the glyph silhouette extended diagonally to the bottom-right corner,
   `fill="#000"` at `opacity="0.10"`, clipped to the tile.
3. **Glyph** — *filled* shapes, 2–4 colours. No strokes under 2px.

The shadow is what gives the set its flat-design character. It always runs top-left → bottom-right
at 45°, and is always clipped by the tile's rounded rect:

```xml
<defs><clipPath id="c"><rect width="48" height="48" rx="12"/></clipPath></defs>
<g clip-path="url(#c)">
  <rect width="48" height="48" rx="12" fill="TILE"/>
  <path d="…silhouette extended to 48,48…" fill="#000" opacity="0.10"/>
  <!-- glyph -->
</g>
```

Give the `clipPath` a **unique id per file** (e.g. `clip-planner`). Multiple inline SVGs sharing
an id collide; these render via `<img>` so it is not a live problem today, but it breaks the
moment anyone inlines them.

## Tile palette — one colour per tool

**Every tool gets its own tile colour.** An earlier version of this guide assigned colour by
category; that was wrong. With 9 Planning and 10 Leadership tools it forced up to ten icons onto a
single hex, which is precisely the homogeneity the redesign exists to kill.

Colour is drawn from a 35-step wheel so that no two tools share a hex, and adjacent cards in the
grid land in different hue families. Category is still *loosely* legible because related tools sit
near each other on the wheel (all the Leadership tools are warm, Early Years are teal-to-lime), but
identity beats category wherever the two conflict.

Keep tiles at a mid-to-deep saturation so white glyph elements stay readable on them. Avoid pastels
— they wash out against the `#F1EFE3` page background.

### Assigned tiles — the authoritative list

Category still clusters loosely by hue family, but no hex repeats.

| Icon key | Tool | Tag | Tile |
|---|---|---|---|
| `planner` | Lesson Planner | Planning | `#2563EB` |
| `medium-term` | Medium Term Planner | Planning | `#1E40AF` |
| `topic` | Topic Overview | Planning | `#3B82F6` |
| `presentation` | Slideshow Generator | Planning | `#0EA5E9` |
| `cpd-slideshow` | CPD Slideshow | Planning | `#0891B2` |
| `policy` | Policy Generator | Planning | `#475569` |
| `risk-assessment` | Risk Assessment | Planning | `#B45309` |
| `cover-lesson` | Cover Lesson | Planning | `#14B8A6` |
| `assembly` | Assembly Planner | Planning | `#6366F1` |
| `worksheet` | Worksheet Generator | Assessment | `#7C3AED` |
| `exam` | Exam Question Generator | Assessment | `#9333EA` |
| `model-answer` | Model Answer Generator | Assessment | `#A855F7` |
| `quiz` | Quiz Generator | Assessment | `#4F46E5` |
| `report` | Report Writer | Assessment | `#8B5CF6` |
| `homework` | Homework Generator | Assessment | `#C026D3` |
| `comprehension` | Comprehension Generator | Literacy | `#EA580C` |
| `model-text` | Model Text Generator | Literacy | `#D97706` |
| `phonics` | Phonics Support | Literacy | `#F59E0B` |
| `eyfs` | EYFS Planner | Early Years | `#0D9488` |
| `eyfs-action-plan` | EYFS Action Plan | Early Years | `#059669` |
| `smart-targets` | SMART Targets | SEND | `#16A34A` |
| `sensory` | Sensory Activities | SEND | `#65A30D` |
| `one-page-profile` | One Page Profile | SEND | `#10B981` |
| `behaviour-support-plan` | Behaviour Plan | SEND | `#4D7C0F` |
| `intervention` | Targeted Intervention | SEND | `#22C55E` |
| `sip` | School Improvement Plans | Leadership | `#BE123C` |
| `ect-report` | ECT Report Writer | Leadership | `#E11D48` |
| `inspection-prep` | Inspection Prep | Leadership | `#DB2777` |
| `learning-walk` | Learning Walk Report | Leadership | `#9F1239` |
| `lesson-observation` | Lesson Observation | Leadership | `#F43F5E` |
| `meeting-planner` | Meeting Planner | Leadership | `#EF4444` |
| `performance-management` | Performance Management | Leadership | `#7C2D12` |
| `letter-writer` | Letter Writer | Leadership | `#EC4899` |
| `pupil-premium` | Pupil Premium Planner | Leadership | `#334155` |
| `newsletter` | Newsletter Writer | Leadership | `#F97316` |

## Never draw a glyph in the tile's own colour

The most common way one of these icons fails: a detail is drawn in the same hex as the tile behind
it (or a near neighbour), and it disappears. It looks fine in the editor at 400px and turns to mud
at 28px. Four icons in the first full pass had exactly this bug — the quiz `?`, the pupil-premium
`$`, and two others.

Rule: **glyph detail is `#1E3C54`, `#FFFFFF`, or an accent from the palette below — never the
tile colour.** If a shape needs to read as "cut out" of the tile, use `#1E3C54` rather than the
tile hex.

## Glyph palette

Fills used inside the tile: `#FFFFFF`, `#1E3C54`, `#FFDC21`, `#EF233C`, `#F1EFE3`.

Brand tokens from `app/globals.css` (`--color-primary #FFCC33`, `--color-dark #1C1B1B`) are reused
where they fit.

## Uniqueness rules

Colour alone will not carry uniqueness. Three rules, in priority order:

**1. No two icons share a tile colour.** One hex per tool, from the wheel above.

**2. Cap the "white rectangle" silhouette.** A white rounded rect centred on a coloured tile is the
default any document-shaped tool collapses into — and it is what made the *old* set homogenous. At
most **8 of the 35** may use a plain page/card as the dominant shape, and those 8 must differ
strongly in what sits on top. Everything else must lead with a different primary form:

- a **circle/disc** (target, clock, badge, seal, magnifier)
- a **diagonal or angled object** (pencil, arrow, ruler, flag, rocket)
- a **figure** (person, group, silhouette head)
- an **open/organic form** (book spread, speech bubble, envelope flap, leaf, star)
- a **composite of small parts** (blocks, grid of tiles, stacked bars, chat cluster)

**3. Vary the composition, not just the object.** Rotate the anchor between: centred, offset to one
corner, filling the tile edge-to-edge, or breaking the tile boundary. Two icons using a circle are
fine if one is centred and small and the other bleeds off the edge.

Glyphs are built around what the tool *does*, not the document it emits — that is what collapsed
the old set into a dozen near-identical rectangles.

## Silhouette ledger

Track the dominant form per icon as they are authored, so rule 2 is enforceable rather than
aspirational. Update this as the set is built.

| Silhouette      | Budget | Used by (tile) |
|-----------------|--------|----------------|
| Page / card     | 6      | worksheet `#7C3AED` |
| Circle / disc   | —      | smart-targets `#16A34A`, comprehension `#EA580C` |
| Figure          | —      | |
| Diagonal object | —      | |
| Open / organic  | —      | comprehension (book spread) |
| Composite parts | —      | eyfs `#0D9488`, sip `#BE123C` (bars) |
| Grid / calendar | —      | planner `#2563EB` |

Page/card budget used: **1 of 6.** Reserve the rest for tools where no other form is honest —
likely report-writer, letter-writer, policy, and one or two others.

## Legibility floor

The smallest render in the app is **28px** (`w-7`, `ToolLinkCard.tsx`). That caps detail at roughly
three shapes plus the shadow, and rules out thin internal lines. Check every icon at 28px before
calling it done.

## Constraints

- Hand-written, readable SVG. No embedded rasters, no `<style>` blocks, no external fonts.
- Under ~2KB per file.
- **Never** rely on `currentColor`. These render through `<img>` in `ToolIcon.tsx`, which
  deliberately strips `text-*` classes — the icons are multi-colour and must not be tintable.

## File naming

Filename = the `icon` key in `app/lib/tools.ts`, so `ToolIcon.tsx` can derive the path:

```
public/icons/v2/<icon-key>.svg
```
