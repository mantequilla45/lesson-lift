# Tool cost summary

**All 34 tools are now measured** (real `token_usage`/`asset_cost`/`slide_cost`
rows, pulled directly from Supabase on 2026-08-01) — no figures below are
estimates. Pricing basis: gpt-4o $2.50/$10 per 1M tokens, gpt-image-1
~$0.015/image (floor; some batched/larger images run higher), audio ~$0.010.
See `tool-cost-tiers.md` for the full per-tool breakdown with ranges and
sample sizes.

| Tier | Tools | Cost/run (measured avg) |
|---|---|---|
| Light (short output) | Letter Writer, SMART Targets, Newsletter, One Page Profile, Quiz Generator, Report Writer | ~$0.003–0.007 |
| Standard (one full document) | Pupil Premium, Exam Generator, Comprehension, Medium Term Planner, Learning Walk, CPD Slideshow, Policy, Model Text, Risk Assessment, Lesson Observation, Homework, Performance Mgmt, Cover Lesson, Assembly, Targeted Intervention, Worksheet, Model Answer, Meeting Planner, ECT Report, Topic Overview, Behaviour Plan, Phonics, School Improvement Plan, EYFS Action Plan, Lesson Planner | ~$0.008–0.021 |
| Heavy (large multi-section) | Inspection Prep, Sensory Activities, EYFS Planner | ~$0.021–0.055 |
| Slideshow | Slideshow Generator | ~$0.04 (web/no-AI images) / ~$0.14–0.23 (AI images, avg ~$0.18) |

**Bottom line:** 33 of 34 tools cost under 2.5¢ each — the vast majority sit
in the ~1¢ range. **EYFS Planner is the one standalone outlier**, measuring
~5.5¢ (over 2× its original estimate) — the "all 7 EYFS areas" output is
genuinely large. The slideshow with AI images remains the single most
expensive generation in the product at ~14–23¢ (avg ~18¢), a **downward**
correction from the previous ~26–57¢ estimate now that image cost is
calibrated to real logged data — still roughly **4–6× more expensive** than
the web/Pixabay mode (~4¢). Images remain the dominant cost driver for the
slideshow; text and audio are consistently under a cent each across every
tool measured.
