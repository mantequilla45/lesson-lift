"use client";

import { useEffect, useState } from "react";
import { getEntitlements } from "./entitlements";
import { creditsRemaining, toCredits } from "./plans";

/*
 * The sidebar credit meter.
 *
 * Credits are DERIVED, not stored. There is no balance column and no ledger:
 * `monthly_ai_spend` sums this month's measured provider cost, and the plan's
 * ceiling plus any purchased top-up is the allowance. See the long note above
 * PENCE_PER_CREDIT in plans.ts for why the teacher-facing unit is credits and
 * not pence.
 *
 * Everything here comes from getEntitlements(), which is the display-side twin
 * of the server's checkAllGates(). The two read the same numbers and must stay
 * in agreement, so this deliberately adds no arithmetic of its own beyond the
 * conversion helpers plans.ts already exports.
 */

export interface CreditMeter {
  /** Still loading. The meter renders a neutral placeholder rather than a 0. */
  loading: boolean;
  /** Credits left this month, floored at zero. */
  remaining: number;
  /** The month's allowance in credits, including purchased top-up. */
  allowance: number;
  /** Fraction of the allowance still available, 0 to 1. */
  fraction: number;
  /**
   * Plans with no spend ceiling (Free, which is gated by generation count, and
   * School, which is not modelled). The meter shows the plan's real limit
   * instead of inventing a credit figure it does not have.
   */
  metered: boolean;
  /** When the allowance resets. Grants expire at month end and never roll over. */
  refillsOn: Date;
}

/** The first of next month. Grants expire at month end, so this is the reset. */
function startOfNextMonth(from = new Date()): Date {
  return new Date(from.getFullYear(), from.getMonth() + 1, 1);
}

export function useCreditMeter(): CreditMeter {
  const [state, setState] = useState<Omit<CreditMeter, "refillsOn">>({
    loading: true,
    remaining: 0,
    allowance: 0,
    fraction: 0,
    metered: false,
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const ent = await getEntitlements();
        if (cancelled) return;

        // ceilingPence is null on unmetered plans, and already includes any
        // purchased top-up credit on the rest.
        if (ent.ceilingPence === null) {
          setState({
            loading: false,
            remaining: 0,
            allowance: 0,
            fraction: 0,
            metered: false,
          });
          return;
        }

        const allowance = toCredits(ent.ceilingPence);
        const remaining = creditsRemaining(ent.spendPence, ent.ceilingPence);
        setState({
          loading: false,
          remaining,
          allowance,
          // Guard the divide: a zero allowance would otherwise give NaN and a
          // progress bar with no width at all.
          fraction: allowance > 0 ? remaining / allowance : 0,
          metered: true,
        });
      } catch {
        // A failed lookup must not take the sidebar down with it. Falling back
        // to unmetered hides the meter rather than showing a wrong balance.
        if (!cancelled) {
          setState({
            loading: false,
            remaining: 0,
            allowance: 0,
            fraction: 0,
            metered: false,
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { ...state, refillsOn: startOfNextMonth() };
}
