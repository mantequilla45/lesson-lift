# Slideshow / editor fixes — tracking

Working doc for the batch of slideshow + editor fixes raised on 2026-06-15.
Status legend: ☐ todo · ◐ in progress · ☑ done

---

## 1. ☑ Audio doesn't play in Present mode (+ check downloaded PPTX)

**Reported:** Audio doesn't play whilst in Present mode. Also verify whether a
downloaded PPTX plays it.

**Root cause:**
- `PresentationViewer` renders slides via `MiniSlide` → `MiniAudio`, a **static
  pill** with no playable `<audio>` element.
- `handleExport` ([Editor.tsx](../app/components/editor/Editor.tsx)) uses pptxgenjs
  but embeds **no audio/video at all** — confirmed, so the downloaded PPTX is silent.

**Fix:**
- Present mode: the themed audio card is now the player — `MiniSlide`/`MiniAudio`
  take a `live` flag so the play button drives a hidden `<audio>` (progress bar
  fills). (First attempt overlaid a native `<audio controls>` which showed as a
  duplicate "separate player" in full screen — replaced with the live card.)
- PPTX export: embed the mp3 via pptxgenjs `addMedia` (audio). Verify it plays in
  PowerPoint.

---

## 2. ☑ Edit button to re-do the original prompt

**Reported / clarified:** An **Edit** button, **top-left** in the editor, that lets
the user **readjust their initial prompt** and **re-generate** the slideshow.

**Root cause / gap:** Generation params (topic, instructions, toggles, etc.) live
only in `sessionStorage` (`GENERATION_STORAGE_KEY`) at create time — not persisted,
so there's nothing to reopen later.

**Fix:**
- Add `generation_params jsonb` column to `presentations`; save the params when a
  deck is generated.
- Top-left **Edit** button in the editor → reopens the generation form (GenerateModal)
  **pre-filled** with the saved params → on submit, re-runs generation for the same
  presentation (replaces the deck).

---

## 3. ☑ Additional instructions should "seam into" the deck

**Reported:** The weight of the "additional instructions" prompt should seam into
the PPT.

**Root cause:** Appended once as a low-emphasis line; not propagated to image/YouTube.

**Done:**
- Elevated to a ★ PRIORITY directive in `generate-slideshow` — applies throughout
  the deck (tone, content, examples, vocabulary, image choices), overrides default
  style on conflict.
- Threaded `additionalInstructions` into the in-deck YouTube search.

---

## 4. ☑ Replace inline "Edit audio" with the sidebar audio (replace whole clip)

**Reported:** Remove the "Edit audio" button on the audio and replace it with the
sidebar audio button so they can replace the entire audio.

**Root cause:** `AudioElement`'s "Edit audio" button only re-rolls the questions
(via `EditAudioPanel`).

**Fix:**
- Removed the inline "Edit audio" button.
- Audio is now a contextual-toolbar selection (it wasn't before — it relied on the
  inline button). Clicking a clip shows a toolbar: **Replace audio · Lock · Delete**.
- **Replace audio** opens the **Sidebar → Audio** panel (via `openSignal`); its
  **Generate** replaces the selected clip (src/title/transcript/questions) in place
  instead of inserting a new slide.

---

## 5. ☑ Video AI suggest must follow the prompt

**Reported:** Asked for a children's book, got videos on ant colonies / chia seeds.

**Root cause:** `find-youtube`'s query-refinement leaned on deck/topic context;
the teacher's explicit instruction was under-weighted.

**Done:**
- Restructured the `find-youtube` prompt so the teacher's instruction is the
  **primary search driver** (matches exact subject/medium/format requested), with
  topic/title only as secondary context.

---

## 6. ☑ Remove background loads forever / blocks other images

**Reported:** Remove background doesn't work — loads for a long time; clicking a
different image still shows loading; doesn't recognise, had to move on.

**Root cause:** `handleRemoveBg` downloads an **~80 MB ONNX model** (`isnet`) on
first use; a single global `removingBg` flag blocks everything; no progress /
timeout / error surfaced — a slow or stalled download looks like an infinite hang.

**Decision:** Move it **server-side**.

**BLOCKER (2026-06-15):** `@imgly/background-removal-node` won't install and pulls
`onnxruntime-node` (heavy native binaries) that won't run on typical serverless
deploys. Need a different server-side path — options:
- **remove.bg API** (or similar hosted service) — lightweight HTTP call, deploys
  fine, needs an API key (free tier ~50/mo). Recommended for true server-side.
- **Robust client-side fix instead** — keep `@imgly/background-removal` but serve
  the model from our own `/public` (the default CDN fetch is what hangs), add
  progress + timeout + per-image spinner + reliable reset.
- _Awaiting decision before building._

---

## Decisions log
- #2: Edit button is for the **original prompt** (top-left), re-runs generation.
- #6: **Server-side** background removal — but the node lib is unworkable; pick
  remove.bg API vs robust client-side fix.

## Build order / status — ALL DONE
3 ☑ · 5 ☑ · 1 ☑ · 4 ☑ · 2 ☑ · 6 ☑

### Final decisions
- #2: prompt-only edit modal (topic + additional instructions); other saved
  settings kept; `presentations.generation_params` jsonb persists the params;
  "Edit prompt" button top-left in EditorTopBar → regenerates via full reload.
- #6: robust client-side (kept @imgly) — per-image spinner, progress %, 180s
  timeout, error banner, reliable reset. (Model still loads from @imgly's CDN;
  progress is now visible. Self-hosting the 80MB model to /public was deemed not
  worth it.)

### Verify after deploy
- #1: open a downloaded PPTX in PowerPoint and confirm the audio icon plays.
- #6: first remove-bg downloads ~80MB once — confirm the % advances.
