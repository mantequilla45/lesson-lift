// Changing a price in Stripe, safely.
//
// Stripe Price objects are IMMUTABLE — there is no API call that changes 799 to
// 849. A price change is always: create a new Price on the same Product, point
// at the new one, archive the old one. This module is the single implementation
// of that dance, shared by the plan and top-up-pack admin routes.
//
// What this does NOT do, and cannot: move existing subscribers. A customer keeps
// billing against the Price they subscribed on until their subscription is
// explicitly migrated. That is Stripe's behaviour and the admin UI says so
// rather than implying a change is retroactive.
import "server-only";
import type Stripe from "stripe";
import { stripe } from "./stripe";

export type PriceInterval = "month" | "year" | "one_time";

export interface PriceChangeResult {
  priceId: string;
  productId: string;
  previousPriceId: string | null;
  unitAmount: number;
}

/** GBP major units → the integer minor units Stripe expects. */
export function toMinorUnits(amountGbp: number): number {
  // Round rather than truncate: 8.49 * 100 is 848.9999… in binary floating
  // point, and truncating would silently sell it for £8.48.
  return Math.round(amountGbp * 100);
}

/**
 * Validate an amount before it becomes real money.
 *
 * Deliberately strict about the upper bound as well as the lower: the most
 * plausible admin mistake is entering pence where pounds were meant (or the
 * reverse), and a £799 subscription would be charged happily by Stripe.
 */
export function assertSaneAmount(amountGbp: number, label: string): void {
  if (!Number.isFinite(amountGbp)) {
    throw new Error(`${label}: amount must be a number.`);
  }
  if (amountGbp <= 0) {
    throw new Error(`${label}: amount must be greater than zero.`);
  }
  if (amountGbp > 500) {
    throw new Error(
      `${label}: £${amountGbp} looks wrong — refusing anything over £500. Check pounds vs pence.`,
    );
  }
  if (toMinorUnits(amountGbp) !== Number(toMinorUnits(amountGbp).toFixed(0))) {
    throw new Error(`${label}: amount must be a whole number of pence.`);
  }
}

/**
 * Resolve the Product a price belongs to, so the replacement lands on the same
 * Product and keeps its name, history and reporting continuity.
 *
 * Also serves as the ownership check: retrieving a price id that belongs to a
 * different account throws, so a crafted id can't be used to repoint our plans
 * at someone else's Price.
 */
async function productForPrice(priceId: string): Promise<string> {
  const price = await stripe.prices.retrieve(priceId);
  const productId = typeof price.product === "string" ? price.product : price.product.id;
  if (!productId) {
    throw new Error(`Price ${priceId} has no product.`);
  }
  return productId;
}

/**
 * Create a replacement Price and archive the old one.
 *
 * Order matters: create first, archive second. If archiving fails we are left
 * with two active prices — untidy, but harmless, because the caller repoints to
 * the new one. Archiving first would risk a window with no sellable price at all
 * if creation then failed.
 *
 * @param currentPriceId the price being replaced; also identifies the Product
 * @param productName    used only when there is no current price to inherit from
 */
export async function replacePrice(opts: {
  currentPriceId: string | null;
  productName: string;
  amountGbp: number;
  interval: PriceInterval;
  label: string;
}): Promise<PriceChangeResult> {
  const { currentPriceId, productName, amountGbp, interval, label } = opts;

  assertSaneAmount(amountGbp, label);
  const unitAmount = toMinorUnits(amountGbp);

  // Reuse the existing Product where there is one, so the change reads as a
  // price revision rather than a brand-new thing in Stripe's reporting.
  const productId = currentPriceId
    ? await productForPrice(currentPriceId)
    : (await stripe.products.create({ name: productName })).id;

  const params: Stripe.PriceCreateParams = {
    product: productId,
    currency: "gbp",
    unit_amount: unitAmount,
    ...(interval === "one_time"
      ? {}
      : { recurring: { interval: interval === "year" ? "year" : "month" } }),
  };

  const created = await stripe.prices.create(params);

  // Make the new price the product's default so anything reading the Product
  // (Payment Links, the dashboard) follows the change too.
  try {
    await stripe.products.update(productId, { default_price: created.id });
  } catch (err) {
    console.error("[stripe-prices] could not set default_price", err);
  }

  if (currentPriceId && currentPriceId !== created.id) {
    try {
      await stripe.prices.update(currentPriceId, { active: false });
    } catch (err) {
      // Non-fatal: the new price is live and the caller is about to point at it.
      // An orphaned active price sells nothing unless something references it.
      console.error("[stripe-prices] could not archive previous price", err);
    }
  }

  return {
    priceId: created.id,
    productId,
    previousPriceId: currentPriceId,
    unitAmount,
  };
}

/**
 * Confirm a price is usable for the purpose we intend, before storing it.
 *
 * Guards the failure mode that would be hardest to spot: a recurring price
 * pointed at the one-off top-up (Checkout's `mode: "payment"` rejects it at the
 * moment a teacher tries to pay), or a one-off price pointed at a subscription.
 */
export async function assertPriceUsable(
  priceId: string,
  expect: { interval: PriceInterval },
): Promise<Stripe.Price> {
  const price = await stripe.prices.retrieve(priceId);

  if (!price.active) {
    throw new Error(`Price ${priceId} is archived in Stripe.`);
  }
  if (price.currency !== "gbp") {
    throw new Error(`Price ${priceId} is in ${price.currency.toUpperCase()}, not GBP.`);
  }
  if (expect.interval === "one_time") {
    if (price.recurring) {
      throw new Error(
        `Price ${priceId} is recurring, but the top-up must be a one-time price.`,
      );
    }
  } else {
    if (!price.recurring) {
      throw new Error(`Price ${priceId} is one-time, but a plan needs a recurring price.`);
    }
    if (price.recurring.interval !== expect.interval) {
      throw new Error(
        `Price ${priceId} bills ${price.recurring.interval}ly, expected ${expect.interval}ly.`,
      );
    }
  }

  return price;
}
