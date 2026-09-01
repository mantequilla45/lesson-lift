// Server-only Stripe client + the mapping between our PlanId/interval and the
// Stripe Price IDs. This is the single place that knows how a plan becomes a
// price and how a paid price becomes a plan, so the checkout route and the
// webhook stay in agreement.
//
// WHERE PRICE IDs LIVE
// Prices are configured in the database (plan_config.stripe_price_monthly,
// topup_packs.stripe_price_id) and fall back to the environment variables when
// the column is null. The database is what the admin console writes, so a price
// change is a live action rather than a redeploy; the env var remains the
// recovery path if a bad write ever lands, and keeps local dev working with no
// DB setup.
//
// Price IDs are not secrets — they appear in any Checkout URL and identify a
// product the way a SKU does. STRIPE_SECRET_KEY is the secret and stays in the
// environment.
import "server-only";
import Stripe from "stripe";
import type { PlanId } from "./plans";
import { supabaseAdmin } from "./supabase-admin";

if (!process.env.STRIPE_SECRET_KEY) {
  // Fail loud at import time in any server context that needs Stripe, rather
  // than producing a confusing 500 deep inside a request.
  throw new Error("STRIPE_SECRET_KEY is not set");
}

// No apiVersion override — use the version pinned by this SDK release so the
// TypeScript types and the wire behaviour always match.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/** The only plan that is self-serve via Stripe Checkout. `free` needs no
 *  payment; `max` is withdrawn from sale; `school` is custom/contact-sales
 *  (per-seat, invoiced, not a self-serve Checkout price). */
export type PaidPlanId = Extract<PlanId, "pro" | "max">;

/** The plans checkout will sell. Anything else is rejected before Stripe. */
export const PAID_PLAN_IDS: PaidPlanId[] = ["pro", "max"];

export function isPaidPlanId(value: unknown): value is PaidPlanId {
  return typeof value === "string" && (PAID_PLAN_IDS as string[]).includes(value);
}

/**
 * Resolve the configured Stripe Price ID for a paid plan. Billing is monthly
 * only — there is no annual price.
 *
 * Reads plan_config first, falls back to the env var. A DB error is treated the
 * same as "not configured" and falls through to the env var rather than failing
 * checkout: a database blip should not stop someone paying us.
 */
export async function priceIdFor(plan: PaidPlanId): Promise<string> {
  const envPriceId = {
    pro: process.env.STRIPE_PRICE_PRO_MONTHLY,
    max: process.env.STRIPE_PRICE_MAX_MONTHLY,
  }[plan];

  const { data, error } = await supabaseAdmin
    .from("plan_config")
    .select("stripe_price_monthly")
    .eq("plan_id", plan)
    .maybeSingle();

  if (error) {
    console.error("[stripe] plan_config price lookup failed, using env", error);
  }

  const priceId = data?.stripe_price_monthly || envPriceId;
  if (!priceId) {
    throw new Error(`No Stripe price configured for plan=${plan}`);
  }
  return priceId;
}

/**
 * The one-off AI-credit top-up price. Must be a ONE-TIME price — Checkout's
 * `mode: "payment"` rejects recurring prices.
 *
 * Reads the active credit pack, falls back to the env var.
 */
export async function topUpPriceId(): Promise<string> {
  const envPriceId = process.env.STRIPE_PRICE_CREDIT_TOP_UP;

  const { data, error } = await supabaseAdmin
    .from("topup_packs")
    .select("stripe_price_id")
    .eq("kind", "credit_gbp")
    .eq("active", true)
    .order("sort")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[stripe] topup pack price lookup failed, using env", error);
  }

  const priceId = data?.stripe_price_id || envPriceId;
  if (!priceId) {
    throw new Error("No Stripe price configured for the credit top-up");
  }
  return priceId;
}

/**
 * Reverse lookup: which of our plans does a paid Stripe Price ID grant?
 *
 * THIS MUST RECOGNISE SUPERSEDED PRICES. Stripe Price objects are immutable, so
 * changing a price means creating a new one — but existing subscribers keep
 * billing against the price they signed up on, potentially for years. The
 * webhook treats a null return as "no subscription" and drops the user to Free,
 * so a lookup that only knew the *current* price would silently downgrade every
 * existing subscriber the first time a price changed.
 *
 * plan_price_history records every price ever pointed at a plan, archived ones
 * included. The env var and the current plan_config value are checked too, so
 * this still resolves correctly before any price change has been recorded.
 *
 * Returns null for prices we genuinely don't recognise.
 */
export async function planForPriceId(
  priceId: string | undefined | null,
): Promise<PlanId | null> {
  if (!priceId) return null;

  // Cheap path: the prices currently configured in the environment.
  if (priceId === process.env.STRIPE_PRICE_PRO_MONTHLY) return "pro";
  if (priceId === process.env.STRIPE_PRICE_MAX_MONTHLY) return "max";

  const { data: historic, error: historyErr } = await supabaseAdmin
    .from("plan_price_history")
    .select("plan_id")
    .eq("stripe_price_id", priceId)
    .maybeSingle();

  if (historyErr) {
    console.error("[stripe] plan_price_history lookup failed", historyErr);
  }
  if (historic?.plan_id) return historic.plan_id as PlanId;

  // A price set in plan_config but not yet recorded in history — possible if a
  // price were ever changed by hand in the database rather than through the
  // admin route, which writes both.
  const { data: current, error: currentErr } = await supabaseAdmin
    .from("plan_config")
    .select("plan_id")
    .eq("stripe_price_monthly", priceId)
    .maybeSingle();

  if (currentErr) {
    console.error("[stripe] plan_config reverse lookup failed", currentErr);
  }
  if (current?.plan_id) return current.plan_id as PlanId;

  return null;
}
