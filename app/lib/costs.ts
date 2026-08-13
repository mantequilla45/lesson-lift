// ── Cost & pricing model ─────────────────────────────────────────────────────
// MODELLING DEFAULTS ONLY. These are the CEO's measured cost-sheet figures
// (Aug 2026) from docs/jooma-admin-console.html, and they exist so the Plans
// page can answer "if a teacher used their whole allowance, would this plan
// still make money?" before a single teacher is on it.
//
// They are NOT a substitute for real cost. Anywhere the console reports what a
// teacher or school ACTUALLY cost, the figure comes from token_usage.cost_usd +
// asset_cost.cost_usd via the admin_* RPCs. Never compute a reported actual
// from the constants below.

import { FX_USD_TO_GBP } from "@/app/admin/format";

/** Measured unit costs, in GBP, converted from the USD cost sheet. */
export const COST = {
  /** Blended across the 34 text tools. */
  text: 0.0109 * FX_USD_TO_GBP,
  /** Slideshow using free library (Pixabay) images. */
  deckWeb: 0.0401 * FX_USD_TO_GBP,
  /** Slideshow using AI-generated images — 33x a text resource. */
  deckAI: 0.36 * FX_USD_TO_GBP,
  /** A single generated image. */
  image: 0.0455 * FX_USD_TO_GBP,
  /** Average images in an AI-image deck. The main lever on gross margin. */
  imagesPerDeck: 6.8,
  /** Stripe UK card fees. */
  cardPct: 0.015,
  cardFixed: 0.2,
  /** Per paying user per month. */
  infra: 0.15,
  support: 0.2,
} as const;

// ── School seat ladder ───────────────────────────────────────────────────────
// Declining per-seat price, minimum 10 seats. Crossing a band re-prices EVERY
// seat, not just the new ones — `seat_rate(n)` in Postgres is the authoritative
// implementation; this mirrors it for client-side previews only.

export interface SeatBand {
  band: string;
  min: number;
  max: number;
  rate: number;
}

export const SEAT_BANDS: SeatBand[] = [
  { band: "10–19", min: 10, max: 19, rate: 4.25 },
  { band: "20–49", min: 20, max: 49, rate: 3.5 },
  { band: "50–99", min: 50, max: 99, rate: 2.95 },
  { band: "100+", min: 100, max: 9999, rate: 2.5 },
];

export const MIN_SEATS = 10;

/** Per-seat monthly rate for a given seat count. */
export function seatRate(n: number): number {
  return (SEAT_BANDS.find((b) => n >= b.min && n <= b.max) ?? SEAT_BANDS[0]).rate;
}

export function seatBand(n: number): SeatBand {
  return SEAT_BANDS.find((b) => n >= b.min && n <= b.max) ?? SEAT_BANDS[0];
}

/** One-off onboarding & training package. Waived on two-year deals. */
export const ONBOARD_FEE = 395;

/** Per-seat monthly pool allowances for the School plan. */
export const SEAT_RESOURCES_PER_MONTH = 300;
export const SEAT_AI_IMAGES_PER_MONTH = 3;

// ── Plan margin modelling ────────────────────────────────────────────────────

export interface WorstCaseInput {
  priceMonthly: number;
  monthlyResources: number;
  aiImageSlideshows: number;
  /** Schools pay by BACS, so no card fee. */
  cardFees: boolean;
  /** Free plan carries no infra/support allocation. */
  chargeOverheads: boolean;
  /**
   * The enforced monthly AI-spend ceiling in PENCE, if the plan has one.
   *
   * This is a hard stop, not a guideline: generation is blocked once measured
   * spend reaches it (my_generation_gate), so a plan with a ceiling can never
   * cost more than this in AI no matter how the allowance is used. Without it
   * the model multiplies out an allowance the gate makes unreachable — Pro
   * modelled at £6.00 of AI when £1.50 is the most it can ever reach.
   */
  spendCeilingPence?: number | null;
}

export interface WorstCase {
  /** AI cost if the teacher used everything they are allowed to. */
  aiCost: number;
  cardFee: number;
  overheads: number;
  contribution: number;
  marginPct: number | null;
  /**
   * True when the spend ceiling — not the allowance — is what caps the cost.
   * The console says so, because "cost if fully used" means something quite
   * different when a hard stop is doing the capping.
   */
  cappedByCeiling: boolean;
}

/**
 * What a plan leaves you if a teacher used everything available to them.
 *
 * Two different caps can bind, and the tighter one wins:
 *   - the ALLOWANCE (n resources, n AI decks), which is what Free is gated on;
 *   - the SPEND CEILING in pence, which is what actually stops a Pro teacher.
 *
 * Modelling the allowance alone overstates the cost of any plan with a ceiling,
 * because the gate blocks generation long before the allowance runs out. Pro
 * shows £6.00 of AI on the allowance and £1.50 on the ceiling; only the second
 * is reachable.
 */
export function worstCase(input: WorstCaseInput): WorstCase {
  const allowanceCost =
    input.monthlyResources * COST.text + input.aiImageSlideshows * COST.deckAI;

  const ceiling =
    input.spendCeilingPence != null ? input.spendCeilingPence / 100 : null;

  // The ceiling only binds if it is the lower of the two — a ceiling above what
  // the allowance permits would never be reached.
  const cappedByCeiling = ceiling != null && ceiling < allowanceCost;
  const aiCost = cappedByCeiling ? ceiling : allowanceCost;

  const cardFee = input.cardFees ? input.priceMonthly * COST.cardPct + COST.cardFixed : 0;
  const overheads = input.chargeOverheads ? COST.infra + COST.support : 0;
  const contribution = input.priceMonthly - aiCost - cardFee - overheads;
  return {
    aiCost,
    cardFee,
    overheads,
    contribution,
    marginPct: input.priceMonthly > 0 ? contribution / input.priceMonthly : null,
    cappedByCeiling,
  };
}

/** Margin tone thresholds, shared by every margin chip in the console. */
export function marginTone(margin: number | null): "ok" | "warn" | "danger" | "plain" {
  if (margin === null) return "plain";
  if (margin < 0) return "danger";
  if (margin < 0.35) return "warn";
  return "ok";
}
