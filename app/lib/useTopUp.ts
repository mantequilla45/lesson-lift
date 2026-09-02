"use client";

import { useState } from "react";

/*
 * Starting a credit top-up.
 *
 * There are two places a teacher can buy credit — the sidebar modal and the
 * allowance meter on the billing page — and they must behave identically: same
 * endpoint, same one-off Checkout session, same error handling. They did not
 * always. The sidebar used to navigate to the billing page instead of buying
 * anything, which dead-ended for anyone below the meter's 80% threshold because
 * the button they were being sent to was not rendered yet.
 *
 * The credit is granted by the Stripe webhook once payment confirms, never by
 * the client. This only opens the session.
 */

export interface TopUp {
  /** Opens Checkout for a pack, or the default pack when given no id.
   *  Redirects on success, so it does not resolve normally. */
  start: (packId?: string | null) => Promise<void>;
  loading: boolean;
  error: string | null;
}

export function useTopUp(): TopUp {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(packId?: string | null) {
    setLoading(true);
    setError(null);
    try {
      // No pack named means "the default pack", which is the request this route
      // has always received. The route re-checks that the caller's plan may buy
      // the pack, so sending an id here is a request, not a grant.
      const res = await fetch("/api/stripe/topup", {
        method: "POST",
        ...(packId
          ? {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ packId }),
            }
          : {}),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        // Full navigation, not router.push: this is Stripe's domain.
        //
        // Stay in the loading state. The redirect is in flight but the page is
        // still interactive for a moment, and re-enabling the button invites a
        // second Checkout session for the same purchase.
        window.location.href = data.url;
        return;
      }
      setError(data.error ?? "Could not start checkout.");
    } catch {
      setError("Network error. Please try again.");
    }
    // Only reached when the purchase did NOT start, so the button becomes
    // usable again for a retry.
    setLoading(false);
  }

  return { start, loading, error };
}
