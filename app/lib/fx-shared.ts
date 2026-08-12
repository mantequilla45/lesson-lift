// FX types and thresholds shared between server and client.
//
// Split out from ./fx.ts because that module is `server-only` (it uses the
// service-role client), and the admin Plans view is a client component that
// still needs the shape and the staleness threshold.

export interface FxRate {
  usdToGbp: number;
  reviewedAt: string;
  note: string | null;
  /** Days since a human last checked the rate against reality. */
  ageDays: number;
  /** True when the TypeScript fallback disagrees with the stored rate. */
  drifted: boolean;
}

/** Flag the rate as needing review after roughly a quarter. */
export const FX_REVIEW_AFTER_DAYS = 120;
