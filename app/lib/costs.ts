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
}

export interface WorstCase {
  /** AI cost if the teacher used every resource and every AI image. */
  aiCost: number;
  cardFee: number;
  overheads: number;
  contribution: number;
  marginPct: number | null;
}

/**
 * What a plan leaves you if a teacher used 100% of their allowance. This is
 * the number that decides whether a plan is viable — the AI-image allowance
 * dominates it, because each deck costs 33x a text resource.
 */
export function worstCase(input: WorstCaseInput): WorstCase {
  const aiCost = input.monthlyResources * COST.text + input.aiImageSlideshows * COST.deckAI;
  const cardFee = input.cardFees ? input.priceMonthly * COST.cardPct + COST.cardFixed : 0;
  const overheads = input.chargeOverheads ? COST.infra + COST.support : 0;
  const contribution = input.priceMonthly - aiCost - cardFee - overheads;
  return {
    aiCost,
    cardFee,
    overheads,
    contribution,
    marginPct: input.priceMonthly > 0 ? contribution / input.priceMonthly : null,
  };
}

/** Margin tone thresholds, shared by every margin chip in the console. */
export function marginTone(margin: number | null): "ok" | "warn" | "danger" | "plain" {
  if (margin === null) return "plain";
  if (margin < 0) return "danger";
  if (margin < 0.35) return "warn";
  return "ok";
}
