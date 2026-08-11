// Server-only Stripe client + the mapping between our PlanId/interval and the
// Stripe Price IDs configured in the environment. This is the single place that
// knows how a plan becomes a price and how a paid price becomes a plan, so the
// checkout route and the webhook stay in agreement.
import "server-only";
import Stripe from "stripe";
import type { PlanId } from "./plans";

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
export type PaidPlanId = Extract<PlanId, "pro">;

/** Resolve the configured Stripe Price ID for a paid plan. Billing is monthly
 *  only — there is no annual price. */
export function priceIdFor(plan: PaidPlanId): string {
  const priceId = { pro: process.env.STRIPE_PRICE_PRO_MONTHLY }[plan];
  if (!priceId) {
    throw new Error(`No Stripe price configured for plan=${plan}`);
  }
  return priceId;
}

/** The one-off £1.50 AI-credit top-up price. Must be a ONE-TIME price —
 *  Checkout's `mode: "payment"` rejects recurring prices. */
export function topUpPriceId(): string {
  const priceId = process.env.STRIPE_PRICE_CREDIT_TOP_UP;
  if (!priceId) {
    throw new Error("STRIPE_PRICE_CREDIT_TOP_UP is not set");
  }
  return priceId;
}

/** Reverse lookup: which of our plans does a paid Stripe Price ID grant?
 *  Returns null for prices we don't recognise — the webhook treats that as
 *  "no subscription", so this must stay in step with what we actually sell. */
export function planForPriceId(priceId: string | undefined | null): PlanId | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_PRO_MONTHLY) return "pro";
  return null;
}
