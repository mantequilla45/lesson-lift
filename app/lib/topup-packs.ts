import { toCredits, type PlanId } from "./plans";

/*
 * The credit packs a teacher can buy.
 *
 * ONE definition of "buyable", shared by the client list and the server-side
 * check in /api/stripe/topup. If the two disagreed, the modal would offer a
 * pack the route then refuses, or worse, the route would sell one the modal was
 * never allowed to show.
 *
 * Deliberately kind='credit_gbp' only. The `resource` and `ai_image` pools have
 * no runtime consumer — generation-guard.ts gates on measured credit spend
 * alone, and monthly_ai_spend() sums only credit_gbp grants — so selling one
 * would take a teacher's money and grant a row nothing ever reads.
 */

/** A pack as the UI needs it. Mirrors the columns of topup_packs. */
export interface TopUpPack {
  id: string;
  name: string;
  /** PENCE of AI spend this pack grants. See the column comment on
   *  topup_packs.unit and toCredits() in plans.ts. */
  unit: number;
  priceGbp: number;
  availableTo: string[];
  sort: number;
}

/** The columns every buyable-pack query needs. */
export const PACK_COLUMNS = "id, name, unit, price_gbp, available_to, sort, stripe_price_id";

/** Shape rows from topup_packs into TopUpPack. */
export function toPack(row: {
  id: string;
  name: string;
  unit: number;
  price_gbp: number | string;
  available_to: string[] | null;
  sort: number | null;
}): TopUpPack {
  return {
    id: row.id,
    name: row.name,
    unit: Number(row.unit),
    priceGbp: Number(row.price_gbp),
    availableTo: row.available_to ?? [],
    sort: Number(row.sort ?? 0),
  };
}

/**
 * May this plan buy this pack?
 *
 * `available_to` is NOT enforced by RLS — the read policy on topup_packs is
 * `active or is_admin()` and ignores the column entirely — so this must be
 * applied on the SERVER as well as in the list. Without the server check a
 * teacher could name any pack's id and buy it regardless of their plan.
 *
 * An empty or absent array means "no plan", not "every plan": a pack with no
 * audience is a misconfiguration, and refusing to sell it is the safe reading.
 */
export function packAllowsPlan(pack: TopUpPack, plan: PlanId): boolean {
  return pack.availableTo.includes(plan);
}

/** Credits this pack grants, derived from its pence so the advertised figure
 *  can never drift from what the grant is worth. */
export function packCredits(pack: TopUpPack): number {
  return toCredits(pack.unit);
}

/**
 * Filter raw rows down to what this plan may actually buy, in display order.
 *
 * The `stripe_price_id` requirement is load-bearing, not defensive: when that
 * column is null, topUpPriceId() falls back to STRIPE_PRICE_CREDIT_TOP_UP — so
 * a half-configured £5 pack would quietly charge the £1.50 environment price.
 * A pack with no price of its own is not for sale.
 */
export function buyablePacks(
  rows: Array<Parameters<typeof toPack>[0] & { stripe_price_id: string | null }>,
  plan: PlanId,
): TopUpPack[] {
  return rows
    .filter((row) => row.stripe_price_id)
    .map(toPack)
    .filter((pack) => packAllowsPlan(pack, plan))
    .sort((a, b) => a.sort - b.sort);
}
