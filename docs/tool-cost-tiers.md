# Tool cost tiers

Tools grouped by per-generation cost/token profile. Costs are USD per generation.
**M** = measured (from real `token_usage`/`asset_cost` rows, pulled directly from
the Supabase `token_usage`/`asset_cost`/`slide_cost` tables). Pricing basis:
gpt-4o $2.50/1M in, $10/1M out · gpt-4o-mini $0.15/$0.60 · gpt-image-1
~$0.015–0.022/image · dall-e-3 $0.04–0.08/image · tts-1 $15/1M chars.

**Every tool is now measured.** As of this pass (2026-08-01), all 34 tools plus
every slideshow sub-tool have at least one real logged generation — no
estimates ("E") remain. Figures below are computed directly from the database
(`min`–`max` range and `avg` across all logged runs per tool), not projected.

---

## Tier definitions

| Tier | Per generation | Shape |
|---|---|---|
| **Small** | ~$0.0001 – $0.008 | one short call / helper; little output |
| **Medium** | ~$0.008 – $0.02 | one full document (passage, worksheet, quiz, set) |
| **Large** | ~$0.02 – $0.06 | one big structured doc (whole plan / scheme / paper) |
| **Slideshow Generator** | variable | its own section — built from several sub-tools + images/audio |

---

## Cost model & analysis (now 34/34 tools measured)

Every gpt-4o text call costs exactly:

> **cost = input × $2.50/1M + output × $10.00/1M**

Output tokens dominate (priced 4× input, and usually 1–4× the volume). With
every tool now measured, the earlier "~$0.012 per 1,000 output tokens" rule of
thumb still roughly holds, but per-tool variance is wider than the original
15-tool sample suggested — some tools (EYFS Planner, Inspection Prep, Sensory
Activities) run meaningfully longer than their prompt shape implied, landing
in the low-Large range rather than Medium.

**Note on `generate-slideshow` in `token_usage`:** this slug covers three
distinct sub-calls tagged by a `step` column (`Deck text`, `Audio script`,
`YouTube`) rather than one single tool — see the Slideshow section below,
where they're broken out separately to match the rest of this doc.

---

## Small (~$0.0001 – $0.008)

Token columns = **total tokens (in + out) per gen**. Range shown as min–max
across all logged runs; avg is the mean.

| Tool | Cost/gen (avg) | Cost range | ×10 | ×100 | Tokens (range) | Tokens (avg) | Runs | Src |
|---|---|---|---|---|---|---|---|---|
| letter-writer | $0.0027 | $0.0026 – $0.0028 | $0.027 | $0.27 | 568 – 584 | 576 | 3 | M |
| smart-targets | $0.0059 | $0.0056 – $0.0062 | $0.059 | $0.59 | 1,137 – 1,189 | 1,160 | 3 | M |
| newsletter-writer | $0.0059 | $0.0047 – $0.0070 | $0.059 | $0.59 | 782 – 1,091 | 937 | 2 | M |
| one-page-profile | $0.0069 | $0.0064 – $0.0072 | $0.069 | $0.69 | 1,321 – 1,398 | 1,366 | 3 | M |
| quiz-generator | $0.0050 | $0.0032 – $0.0069 | $0.050 | $0.50 | 685 – 1,052 | 869 | 2 | M |
| report-writer | $0.0038 | $0.0027 – $0.0048 | $0.038 | $0.38 | 778 – 1,058 | 918 | 2 | M |

## Medium (~$0.008 – $0.02)

| Tool | Cost/gen (avg) | Cost range | ×10 | ×100 | Tokens (range) | Tokens (avg) | Runs | Src |
|---|---|---|---|---|---|---|---|---|
| pupil-premium-planner | $0.0074 | $0.0041 – $0.0108 | $0.074 | $0.74 | 863 – 1,581 | 1,222 | 2 | M |
| exam-question-generator | $0.0078 | $0.0071 – $0.0083 | $0.078 | $0.78 | 1,148 – 1,267 | 1,219 | 3 | M |
| comprehension-generator | $0.0089 | $0.0082 – $0.0094 | $0.089 | $0.89 | 1,221 – 1,383 | 1,312 | 5 | M |
| medium-term-planner | $0.0089 | $0.0085 – $0.0093 | $0.089 | $0.89 | 1,365 – 1,445 | 1,404 | 3 | M |
| learning-walk-report | $0.0089 | $0.0059 – $0.0120 | $0.089 | $0.89 | 1,111 – 1,896 | 1,504 | 2 | M |
| cpd-slideshow | $0.0093 | $0.0057 – $0.0128 | $0.093 | $0.93 | 1,484 – 2,239 | 1,862 | 2 | M |
| policy-generator | $0.0096 | $0.0087 – $0.0105 | $0.096 | $0.96 | 1,357 – 1,561 | 1,459 | 2 | M |
| model-text-generator | $0.0098 | $0.0083 – $0.0112 | $0.098 | $0.98 | 1,355 – 1,683 | 1,519 | 2 | M |
| risk-assessment | $0.0100 | $0.0097 – $0.0103 | $0.100 | $1.00 | 1,526 – 1,648 | 1,587 | 2 | M |
| lesson-observation-report | $0.0105 | $0.0071 – $0.0140 | $0.105 | $1.05 | 1,172 – 2,039 | 1,606 | 2 | M |
| homework-generator | $0.0106 | $0.0101 – $0.0110 | $0.106 | $1.06 | 1,559 – 1,706 | 1,633 | 2 | M |
| performance-management | $0.0110 | $0.0101 – $0.0119 | $0.110 | $1.10 | 1,497 – 1,624 | 1,561 | 2 | M |
| cover-lesson | $0.0110 | $0.0106 – $0.0115 | $0.110 | $1.10 | 1,711 – 1,802 | 1,747 | 3 | M |
| assembly-planner | $0.0111 | $0.0108 – $0.0113 | $0.111 | $1.11 | 1,667 – 1,683 | 1,675 | 2 | M |
| targeted-intervention | $0.0119 | $0.0115 – $0.0122 | $0.119 | $1.19 | 1,481 – 1,620 | 1,551 | 2 | M |
| worksheet-generator | $0.0121 | $0.0107 – $0.0129 | $0.121 | $1.21 | 1,630 – 1,961 | 1,858 | 4 | M |
| model-answer-generator | $0.0121 | $0.0114 – $0.0129 | $0.121 | $1.21 | 1,963 – 2,161 | 2,062 | 2 | M |
| meeting-planner | $0.0127 | $0.0104 – $0.0149 | $0.127 | $1.27 | 1,561 – 2,184 | 1,873 | 2 | M |
| ect-report-writer | $0.0145 | $0.0110 – $0.0181 | $0.145 | $1.45 | 1,714 – 2,670 | 2,192 | 2 | M |
| topic-overview | $0.0146 | $0.0105 – $0.0188 | $0.146 | $1.46 | 1,696 – 2,560 | 2,128 | 2 | M |
| behaviour-support-plan | $0.0176 | $0.0141 – $0.0211 | $0.176 | $1.76 | 2,844 – 3,619 | 3,232 | 2 | M |
| phonics-support | $0.0197 | $0.0188 – $0.0206 | $0.197 | $1.97 | 3,180 – 3,365 | 3,273 | 2 | M |
| school-improvement-plan | $0.0164 | $0.0157 – $0.0171 | $0.164 | $1.64 | 2,113 – 2,391 | 2,252 | 2 | M |
| eyfs-action-plan | $0.0179 | $0.0172 – $0.0186 | $0.179 | $1.79 | 2,710 – 2,814 | 2,762 | 2 | M |
| lesson-planner | $0.0208 | $0.0182 – $0.0225 | $0.208 | $2.08 | 3,117 – 3,430 | 3,304 | 10 | M |

## Large (~$0.02 – $0.06)

| Tool | Cost/gen (avg) | Cost range | ×10 | ×100 | Tokens (range) | Tokens (avg) | Runs | Src |
|---|---|---|---|---|---|---|---|---|
| inspection-prep | $0.0229 | $0.0209 – $0.0249 | $0.229 | $2.29 | 3,260 – 3,821 | 3,541 | 2 | M |
| sensory-activities | $0.0212 | $0.0201 – $0.0223 | $0.212 | $2.12 | 2,672 – 2,884 | 2,778 | 2 | M |
| eyfs-planner | $0.0550 | $0.0544 – $0.0556 | $0.550 | $5.50 | 6,171 – 6,276 | 6,224 | 2 | M |

**Notable finding:** eyfs-planner runs far heavier than its original estimate
(~$0.025 est. → $0.055 measured, more than 2×) — the "all 7 EYFS areas" output
is genuinely large. inspection-prep and sensory-activities also came in above
their Medium estimates, landing at the Medium/Large boundary. Everything else
tracked reasonably close to (or below) its original estimate.

---

## Slideshow Generator

Not a single call — a slideshow is built from several AI sub-tools, so the total
cost is **variable** (depends on image source/count, audio, video). Below is
every sub-tool it uses, then the measured all-in cost per deck.

**Sub-tools** (all measured):

| Sub-tool | Cost/gen (avg) | Cost range | ×10 | ×100 | Tokens (range) | Tokens (avg) | Runs | Src |
|---|---|---|---|---|---|---|---|---|
| suggest-subject (gpt-4o-mini) | $0.00005 | $0.00005 – $0.00005 | $0.0005 | $0.005 | 313 – 317 | 316 | 6 | M |
| edit-text (click-text AI modify) | $0.00006 | $0.00005 – $0.00007 | $0.0006 | $0.006 | 228 – 280 | 254 | 2 | M |
| suggest-vocabulary | $0.00067 | $0.00063 – $0.00070 | $0.0067 | $0.067 | 169 – 176 | 173 | 6 | M |
| find-youtube | $0.0014 | $0.0014 – $0.0014 | $0.014 | $0.14 | 439 – 440 | 440 | 2 | M |
| YouTube (as logged under generate-slideshow, step="YouTube") | $0.0014 | $0.0012 – $0.0020 | $0.014 | $0.14 | 371 – 691 | 451 | 12 | M |
| generate-activity (editor activity) | $0.0019 | $0.0018 – $0.0019 | $0.019 | $0.19 | 427 – 482 | 455 | 2 | M |
| generate-lesson-outline (modal preview) | $0.0027 | $0.0024 – $0.0030 | $0.027 | $0.27 | 406 – 471 | 437 | 5 | M |
| generate-audio (standalone) | $0.0036 | $0.0035 – $0.0038 | $0.036 | $0.36 | 681 – 709 | 693 | 3 | M |
| Audio · script (as logged under generate-slideshow, step="Audio script") | $0.0038 | $0.0032 – $0.0044 | $0.038 | $0.38 | 665 – 779 | 725 | 11 | M |
| Deck text (main generation, step="Deck text") | $0.0299 | $0.0280 – $0.0344 | $0.299 | $2.99 | 6,131 – 6,994 | 6,438 | 12 | M |
| AI image (per image, generate-image + generate-slideshow) | $0.0150 – 0.194 avg $0.0389 | $0.015 – $0.194 | — | — | n/a (per image) | — | 43 | M |
| Audio · speech (tts-1, generate-audio asset_cost) | $0.0102 avg | $0.0080 – $0.0114 | — | — | 532 – 864 **chars** | ~698 | 14 | M |
| Remove background | $0 | $0 | $0 | $0 | in-browser, no API cost | — | — | M |

Note on AI image cost: the per-image average ($0.0389) is pulled up by a small
number of expensive multi-image slides (max $0.194 for a single `asset_cost`
row — likely a batched/larger image or a 1536×1024 generation); the bulk of
individual images still land at the $0.015 floor. Use the $0.015 floor for a
single-image estimate and the average only when projecting a full deck's worth
of AI images.

### ⭐ Full deck — all-in cost per slideshow (the number that matters most)

Pulled from `slide_cost` (one row per generated deck, with a component
breakdown for the two most recent test runs):

| Slideshow | Image source | Cost (all-in) | Text | Audio | Images | Src |
|---|---|---|---|---|---|---|
| "The Water Cycle" (test run, 2026-08-01) | Web / no AI images | **$0.0401** | $0.0285 | $0.0116 | $0 (0 AI images) | M |
| "The Dance of Water" (test run, 2026-08-01) | AI-generated | **$0.2320** | $0.0294 | $0.0157 | $0.187 (11 images) | M |
| "The Heart of Computing" | AI-generated | $0.1787 | — | — | — | M (no breakdown logged) |
| "Mastering the CPU" | AI-generated | $0.1506 | — | — | — | M (no breakdown logged) |
| "The Rhythm of Water" | AI-generated | $0.1387 | — | — | — | M (no breakdown logged) |

> **This is the headline cost.** A slideshow is by far the most expensive
> generation, and the price swings **~5–6×** depending on the **image source**.
> The image setting is the one lever that drives the bill.

| Option | **Cost/deck (measured)** | ×10 | ×100 | Src |
|---|---|---|---|---|
| 🟢 **Web / no-AI images (text only)** | **~$0.04** | **~$0.40** | **~$4.00** | M |
| 🔴 **AI images, all options on** | **~$0.15 – $0.23** (avg ~$0.18) | **~$1.50 – $2.30** | **~$15 – $23** | M |

**Correction from the previous pass:** earlier estimates put the AI-image deck
at ~$0.33–0.57 (based on higher per-image assumptions and a "default image
setting" that mixed web+AI). With `IMAGE_COST_USD` now calibrated to the
$0.015/image floor (see `app/lib/ai-image.ts`) and 5 real full-AI-image decks
logged, the **actual measured range for a fully-AI-image deck is $0.14–$0.23**,
averaging closer to **~$0.18** than the previous ~$0.33–0.57 figures. The
web/auto (Pixabay) case also came in slightly higher than previously measured
($0.04 vs. the earlier $0.03) — consistent with normal run-to-run variance in
topic/instruction length, not a systematic change.

---

## Measured runs (real logs) — historical reference

The section below is retained from the previous pass for its narrative
detail; all figures it references are now superseded by the tables above,
which reflect the complete, current dataset pulled directly from
`token_usage` / `asset_cost` / `slide_cost` on 2026-08-01.

### Slideshow — "The French Revolution", 10 base slides, audio + YouTube on (prior pass)

| Image source | gpt-4o tokens | Text $ | Images | Image $ | Audio $ | Total |
|---|---|---|---|---|---|---|
| Auto / web (Pixabay) | 4,380 + 2,242 | $0.0334 | 0 AI | $0.0000 | (excl.) | ~$0.033 + audio |
| AI generation | 4,384 + 1,689 | $0.0278 | 11 (10× gpt-image-1 1024², 1× 1536×1024) | $0.4830 | (excl.) | ~$0.511 + audio (pre-calibration figure — see correction above) |

### Other tools

All tools are now measured — see the tier tables above. To keep this doc
accurate going forward, re-run this query whenever new usage accumulates and
refresh the averages/ranges rather than re-estimating.
