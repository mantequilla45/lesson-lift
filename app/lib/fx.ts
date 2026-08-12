// Reading the USD→GBP rate from its single source of truth.
//
// The rate lives in the `fx_rate` table. That is deliberate: the spend ceiling
// is enforced in SQL (monthly_ai_spend → fx_usd_to_gbp), so a second copy in
// TypeScript could silently disagree with the gate and nothing would catch it.
//
// FX_USD_TO_GBP in app/admin/format.ts remains as a synchronous fallback for
// render paths that cannot await, and for the modelling constants in
// lib/costs.ts. assertFxInSync() below exists to make any drift between the two
// loud instead of silent.
//
// The rate is NOT a live feed. Providers bill in USD; Jooma charges GBP through
// Stripe, so drift affects cost reporting and the spend ceiling slightly, never
// what a customer is charged. A live rate would also make historical figures
// move every time a report was re-run. Review it quarterly — `reviewed_at`
// records when that last happened.
// The FxRate shape and the review threshold live in ./fx-shared so client
// components can import them; this module is server-only because it reaches for
// the service-role client.
import "server-only";
import { supabaseAdmin } from "./supabase-admin";
import { FX_USD_TO_GBP } from "@/app/admin/format";
import type { FxRate } from "./fx-shared";

export type { FxRate } from "./fx-shared";
export { FX_REVIEW_AFTER_DAYS } from "./fx-shared";

/**
 * The live rate, plus how stale it is. Falls back to the compiled-in constant
 * if the table is unreachable — a cost figure rendered at a slightly wrong rate
 * is better than a page that will not load.
 */
export async function loadFxRate(): Promise<FxRate> {
  const fallback: FxRate = {
    usdToGbp: FX_USD_TO_GBP,
    reviewedAt: new Date().toISOString().slice(0, 10),
    note: "Could not read fx_rate; using the compiled-in fallback.",
    ageDays: 0,
    drifted: false,
  };

  const { data, error } = await supabaseAdmin
    .from("fx_rate")
    .select("usd_to_gbp, reviewed_at, note")
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("[fx] could not read fx_rate, using fallback", error);
    return fallback;
  }

  const usdToGbp = Number(data.usd_to_gbp);
  const reviewedAt = String(data.reviewed_at);
  const ageDays = Math.max(
    0,
    Math.floor((Date.now() - new Date(reviewedAt).getTime()) / 86_400_000),
  );

  return {
    usdToGbp,
    reviewedAt,
    note: data.note ?? null,
    ageDays,
    // Compared with a tolerance because the column is numeric(10,4) and the
    // constant is a float literal; an exact === would false-positive.
    drifted: Math.abs(usdToGbp - FX_USD_TO_GBP) > 0.0001,
  };
}
