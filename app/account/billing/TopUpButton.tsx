"use client";

import { useState } from "react";
import { PLAN_CREDITS } from "@/app/lib/plans";

// Buys a block of credits for £1.50. Server creates the one-off Checkout
// session; we redirect. The credit is granted by the webhook once Stripe
// confirms payment, never here. Repeatable — each purchase is an independent
// session.
//
// The PRICE is stated in pounds (they pay it); the ALLOWANCE is stated in
// credits. See toCredits() in lib/plans.ts for why.
export default function TopUpButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buy() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/topup", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error ?? "Could not start checkout.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={buy}
        disabled={loading}
        className="inline-block py-2.5 px-5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
        style={{ backgroundColor: "var(--j-purple)", color: "#fff" }}
      >
        {loading
          ? "Starting checkout…"
          : `Add ${PLAN_CREDITS.toLocaleString("en-GB")} credits · £1.50`}
      </button>
      {error && <p className="text-sm mt-2" style={{ color: "#c2342b" }}>{error}</p>}
    </div>
  );
}
