# Tool cost tiers

Tools grouped by per-generation cost/token profile. Costs are USD per generation.
**M** = measured (from real `token_usage`/`asset_cost` + manual runs). **E** =
estimate (by generation shape; not yet run). Pricing basis: gpt-4o $2.50/1M in,
$10/1M out · gpt-4o-mini $0.15/$0.60 · gpt-image-1 ~$0.015–0.022/image ·
dall-e-3 $0.04–0.08/image · tts-1 $15/1M chars.

---

## Tier definitions

| Tier | Per generation | Shape |
|---|---|---|
| **Small** | ~$0.0001 – $0.008 | one short call / helper; little output |
| **Medium** | ~$0.008 – $0.02 | one full document (passage, worksheet, quiz, set) |
| **Large** | ~$0.02 – $0.05 | one big structured doc (whole plan / scheme / paper) |
| **Slideshow Generator** | variable | its own section — built from several sub-tools + images/audio |

---

## Cost model & analysis (from 15 measured tools)

Every gpt-4o text call costs exactly:

> **cost = input × $2.50/1M + output × $10.00/1M**

**Output tokens dominate** (priced 4× input, and usually 1–4× the volume). Across
all measured tools the all-in rate is a tight **~$0.012 per 1,000 output tokens**
(range $0.0118–0.0159; the tiny `:YouTube`/`suggest` calls run higher per-1k only
because their fixed input is large relative to a few output tokens). So:

> **A tool's cost ≈ its output length.** Short reply → Small; one full document →
> Medium; a big multi-section doc → Large.

**Key correction:** the original estimates were **~2–3× too high**. Measured single
-call tools land **$0.003–0.021**, not $0.012–0.04. Example: medium-term-planner
was estimated $0.03 (Large) but measured **$0.0089** (Medium) — its output is far
shorter than assumed. All remaining estimates below have been recalibrated down to
the measured pattern (and `medium-term-planner` re-tiered to Medium).

Measured anchors: letter-writer $0.0027 (171 out) · smart-targets $0.0059 (397) ·
one-page-profile $0.0069 (461) · comprehension $0.0089 (754) · medium-term $0.0089
(716) · cover-lesson $0.0110 (885) · worksheet $0.0119 (977) · lesson-planner
$0.0208 (1,727) · slideshow deck text $0.0297 (1,813).

---

## Small (~$0.0001 – $0.008)

Token columns = **total tokens (in + out) per gen**, shown where measured (M);
"—" = not yet run (estimate).

_(Slideshow Generator sub-tools — suggest-subject, suggest-vocabulary,
find-youtube, generate-lesson-outline, generate-audio, generate-activity,
edit-text — moved to their own section below.)_

| Tool | Cost/gen | ×10 | ×100 | Tokens (range) | Tokens (avg) | Src |
|---|---|---|---|---|---|---|
| smart-targets | $0.0059 | $0.059 | $0.59 | 1,137 – 1,189 | 1,160 | M |
| letter-writer | $0.0027 | $0.027 | $0.27 | 568 – 584 | 576 | M |
| one-page-profile | $0.0069 | $0.069 | $0.69 | 1,321 – 1,398 | 1,366 | M |
| meeting-planner | ~$0.005 | ~$0.05 | ~$0.50 | — | — | E |
| newsletter-writer | ~$0.005 | ~$0.05 | ~$0.50 | — | — | E |
| assembly-planner | ~$0.005 | ~$0.05 | ~$0.50 | — | — | E |
| performance-management | ~$0.005 | ~$0.05 | ~$0.50 | — | — | E |

## Medium (~$0.008 – $0.02)

| Tool | Cost/gen | ×10 | ×100 | Tokens (range) | Tokens (avg) | Src |
|---|---|---|---|---|---|---|
| exam-question-generator | $0.0078 | $0.078 | $0.78 | 1,148 – 1,267 | 1,219 | M |
| comprehension-generator | $0.0089 | $0.089 | $0.89 | 1,221 – 1,383 | 1,312 | M |
| medium-term-planner | $0.0089 | $0.089 | $0.89 | 1,365 – 1,445 | 1,404 | M |
| cover-lesson | $0.0110 | $0.110 | $1.10 | 1,711 – 1,802 | 1,747 | M |
| worksheet-generator | $0.0119 | $0.119 | $1.19 | 1,630 – 1,958 | 1,823 | M |
| report-writer | ~$0.012 | ~$0.12 | ~$1.20 | — | — | E |
| lesson-observation-report | ~$0.012 | ~$0.12 | ~$1.20 | — | — | E |
| ect-report-writer | ~$0.012 | ~$0.12 | ~$1.20 | — | — | E |
| behaviour-support-plan | ~$0.012 | ~$0.12 | ~$1.20 | — | — | E |
| eyfs-action-plan | ~$0.012 | ~$0.12 | ~$1.20 | — | — | E |
| phonics-support | ~$0.013 | ~$0.13 | ~$1.30 | — | — | E |
| pupil-premium-planner | ~$0.011 | ~$0.11 | ~$1.10 | — | — | E |
| model-text-generator | ~$0.011 | ~$0.11 | ~$1.10 | — | — | E |
| learning-walk-report | ~$0.011 | ~$0.11 | ~$1.10 | — | — | E |
| homework-generator | ~$0.010 | ~$0.10 | ~$1.00 | — | — | E |
| model-answer-generator | ~$0.010 | ~$0.10 | ~$1.00 | — | — | E |
| topic-overview | ~$0.010 | ~$0.10 | ~$1.00 | — | — | E |
| inspection-prep | ~$0.010 | ~$0.10 | ~$1.00 | — | — | E |
| quiz-generator | ~$0.009 | ~$0.09 | ~$0.90 | — | — | E |
| targeted-intervention | ~$0.009 | ~$0.09 | ~$0.90 | — | — | E |
| risk-assessment | ~$0.009 | ~$0.09 | ~$0.90 | — | — | E |
| sensory-activities | ~$0.009 | ~$0.09 | ~$0.90 | — | — | E |

## Large (~$0.02 – $0.05)

| Tool | Cost/gen | ×10 | ×100 | Tokens (range) | Tokens (avg) | Src |
|---|---|---|---|---|---|---|
| lesson-planner | $0.0208 | $0.208 | $2.08 | 3,117 – 3,430 | 3,304 | M |
| policy-generator | ~$0.03 | ~$0.30 | ~$3.00 | — | — | E |
| eyfs-planner | ~$0.025 | ~$0.25 | ~$2.50 | — | — | E |
| school-improvement-plan | ~$0.025 | ~$0.25 | ~$2.50 | — | — | E |
| cpd-slideshow | ~$0.025 | ~$0.25 | ~$2.50 | — | — | E |
| lesson-slideshow (text) | ~$0.025 | ~$0.25 | ~$2.50 | — | — | E |

## Slideshow Generator

Not a single call — a slideshow is built from several AI sub-tools, so the total
cost is **variable** (depends on image source/count, audio, video). Below is every
sub-tool it uses, then the measured all-in cost per deck.

**Sub-tools** (total tokens in+out where measured; "—" = not yet run):

| Sub-tool | Cost/gen | ×10 | ×100 | Tokens (range) | Tokens (avg) | Src |
|---|---|---|---|---|---|---|
| Deck text (main generation) | $0.0297 | $0.297 | $2.97 | 6,256 – 6,622 | 6,434 | M |
| Audio · script | $0.0039 | $0.039 | $0.39 | 665 – 779 | 725 | M |
| generate-audio (standalone) | $0.0036 | $0.036 | $0.36 | 681 – 709 | 693 | M |
| YouTube (find-youtube) | $0.0012 | $0.012 | $0.12 | 371 – 406 | 382 | M |
| generate-lesson-outline (modal preview) | $0.0028 | $0.028 | $0.28 | 439 – 471 | 454 | M |
| suggest-vocabulary | $0.00066 | $0.0066 | $0.066 | 169 – 176 | 173 | M |
| suggest-subject (gpt-4o-mini) | $0.00005 | $0.0005 | $0.005 | 313 – 317 | 315 | M |
| generate-activity (editor activity) | ~$0.003 | ~$0.03 | ~$0.30 | — | — | E |
| edit-text (click-text AI modify) | ~$0.0005 | ~$0.005 | ~$0.05 | — | — | E |
| AI image / regenerate (per image) | $0.015 – 0.08 | $0.15 – 0.80 | $1.50 – 8.00 | n/a (per image) | — | M |
| Audio · speech (tts-1) | varies | varies | varies | $15/1M **chars** | — | E |
| Remove background | $0 | $0 | $0 | in-browser, no API cost | — | M |

### ⭐ Full deck — all-in cost per slideshow (the number that matters most)

> **This is the headline cost.** A slideshow is by far the most expensive
> generation, and the price swings ~20× depending on the **image source**. The
> image setting is the one lever that drives the bill.

| Option | **Cost/deck** | ×10 | ×100 | Src |
|---|---|---|---|---|
| 🔴 **All AI images, all options on** | **~$0.57** | **~$5.70** | **~$57** | M |
| 🟡 **Default image setting, all options on** | **~$0.33** | **~$3.30** | **~$33** | M |
| 🟢 **Web / no-AI images (text only)** | **~$0.03** | **~$0.30** | **~$3.00** | M |
