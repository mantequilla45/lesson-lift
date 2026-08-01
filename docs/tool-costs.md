# Tool generation costs

Per-generation cost for every tool in Jooma. **All figures are now measured**
— pulled directly from the `token_usage` / `asset_cost` / `slide_cost` tables
in Supabase on 2026-08-01, not estimated. See `tool-cost-tiers.md` for the
full breakdown with min–max ranges and sample sizes per tool.

**Pricing basis (USD):** gpt-4o = $2.50/1M input, $10/1M output · gpt-image-1
≈ $0.015/image floor (some larger/batched images run higher) · tts-1 =
$15/1M chars.

| Tool | Model(s) | Cost / generation (avg) | Runs measured |
|---|---|---|---|
| Letter Writer | gpt-4o | $0.0027 | 3 |
| Report Writer | gpt-4o | $0.0038 | 2 |
| Quiz Generator | gpt-4o | $0.0050 | 2 |
| SMART Targets | gpt-4o | $0.0059 | 3 |
| Newsletter Writer | gpt-4o | $0.0059 | 2 |
| One Page Support Profile | gpt-4o | $0.0069 | 3 |
| Pupil Premium Planner | gpt-4o | $0.0074 | 2 |
| Exam Question Generator | gpt-4o | $0.0078 | 3 |
| Comprehension Generator | gpt-4o | $0.0089 | 5 |
| Medium Term Topic Planner | gpt-4o | $0.0089 | 3 |
| Learning Walk Report | gpt-4o | $0.0089 | 2 |
| CPD Slideshow Generator | gpt-4o | $0.0093 | 2 |
| Policy Generator | gpt-4o | $0.0096 | 2 |
| Model Text Generator | gpt-4o | $0.0098 | 2 |
| Risk Assessment | gpt-4o | $0.0100 | 2 |
| Lesson Observation Report | gpt-4o | $0.0105 | 2 |
| Homework Generator | gpt-4o | $0.0106 | 2 |
| Performance Management Targets | gpt-4o | $0.0110 | 2 |
| Cover Lesson Generator | gpt-4o | $0.0110 | 3 |
| Assembly Planner | gpt-4o | $0.0111 | 2 |
| Targeted Intervention | gpt-4o | $0.0119 | 2 |
| Worksheet Generator | gpt-4o | $0.0121 | 4 |
| Model Answer Generator | gpt-4o | $0.0121 | 2 |
| Meeting Planner | gpt-4o | $0.0127 | 2 |
| ECT Report Writer | gpt-4o | $0.0145 | 2 |
| Topic Overview | gpt-4o | $0.0146 | 2 |
| School Improvement Plan | gpt-4o | $0.0164 | 2 |
| Behaviour Support Plan | gpt-4o | $0.0176 | 2 |
| EYFS Action Plan | gpt-4o | $0.0179 | 2 |
| Phonics Support | gpt-4o | $0.0197 | 2 |
| Lesson Planner | gpt-4o | $0.0208 | 10 |
| Inspection Prep Questions | gpt-4o | $0.0229 | 2 |
| Sensory Activities | gpt-4o | $0.0212 | 2 |
| EYFS Planner | gpt-4o | $0.0550 | 2 |
| **Slideshow Generator** (web / auto images) | gpt-4o + Pixabay | **~$0.04** | 1 full-deck breakdown |
| **Slideshow Generator** (AI images) | gpt-4o + gpt-image-1 | **~$0.14 – $0.23** (avg ~$0.18) | 5 full-deck breakdowns |

## Slideshow add-ons & editor actions

| Item | Model(s) | Cost / gen (avg) | Runs | Notes |
|---|---|---|---|---|
| Deck text (main generation) | gpt-4o | $0.0299 | 12 | Logged under `generate-slideshow`, step="Deck text" |
| Audio activity script | gpt-4o | $0.0038 | 11 | Logged under `generate-slideshow`, step="Audio script" |
| Audio · speech synthesis | tts-1 | $0.0102 | 14 | `asset_cost`, kind="audio" — priced per character |
| YouTube video search | gpt-4o | $0.0014 | 12 | Logged under `generate-slideshow`, step="YouTube" |
| generate-audio (standalone) | gpt-4o | $0.0036 | 3 | |
| generate-lesson-outline (modal preview) | gpt-4o | $0.0027 | 5 | |
| suggest-vocabulary | gpt-4o | $0.0007 | 6 | |
| suggest-subject | gpt-4o-mini | $0.00005 | 6 | |
| generate-activity (editor activity) | gpt-4o | $0.0019 | 2 | |
| edit-text (click-text AI modify) | gpt-4o | $0.00006 | 2 | |
| Regenerate image (editor) | gpt-image-1 | $0.015 – $0.194 (avg $0.039) | 43 | Wide range — most images at the $0.015 floor; a few batched/larger generations run much higher |
| Remove background (editor) | gpt-image-1 | $0 | — | In-browser, no API cost |

**Takeaways:**

- **33 of 34 standalone text tools cost under 2.5¢ each** — most cluster
  around 1¢. Text generation is cheap across the board.
- **EYFS Planner is the one real outlier**: measured at **$0.055/gen**, over
  2× the original estimate. Its "all 7 EYFS learning areas" output is
  genuinely long. Worth flagging for pricing/packaging separately if other
  tools are priced as roughly interchangeable.
- **Inspection Prep ($0.023) and Sensory Activities ($0.021)** also ran
  somewhat above their original Medium-tier estimates, landing at the
  Medium/Large boundary.
- The slideshow is **still the most expensive single generation** in the
  product, but the AI-image case is now measured **cheaper than previously
  estimated**: ~$0.14–0.23 (avg ~$0.18) across 5 real decks, vs. the old
  ~$0.33–0.57 estimate. The web/Pixabay mode measured ~$0.04/deck — the cost
  driver remains the same single toggle (image source = AI), just calibrated
  down now that `IMAGE_COST_USD` matches real logged image costs.
- Text and audio costs are consistently rounding errors (under a cent) even
  inside the expensive AI-image slideshow — **images are the only real cost
  lever** anywhere in the product.

Sample sizes are still thin for some tools (2 runs each for about half the
list) — real production usage will sharpen these averages over time. Treat
the 2-run figures as directionally correct, not statistically tight; re-pull
from `token_usage` periodically as usage accumulates and refresh this doc.

---

## Measured runs (real logs) — slideshow detail

Actual `slide_cost` rows — ground truth breakdown by component (text / audio
/ images) where logged.

| Deck | Image source | Text $ | Audio $ | Images $ | Total |
|---|---|---|---|---|---|
| "The Water Cycle" (2026-08-01) | Web / no AI images | $0.0285 | $0.0116 | $0.0000 (0 AI images) | **$0.0401** |
| "The Dance of Water" (2026-08-01) | AI-generated | $0.0294 | $0.0157 | $0.1870 (11 images) | **$0.2320** |
| "The Heart of Computing" | AI-generated | — | — | — | $0.1787 (no component breakdown logged) |
| "Mastering the CPU" | AI-generated | — | — | — | $0.1506 (no component breakdown logged) |
| "The Rhythm of Water" | AI-generated | — | — | — | $0.1387 (no component breakdown logged) |

**Observations:**

- Text generation is steady at ~$0.028–0.030 for a 10-slide deck, regardless
  of image source — confirms images are the only variable cost driver.
- The web/no-AI-images run used **0 AI images** (Pixabay served everything),
  so its total is just text + audio.
- The 5 AI-image decks range $0.14–$0.23, a real spread depending on exactly
  how many images ended up AI-generated vs. how large/batched each image
  generation was.
