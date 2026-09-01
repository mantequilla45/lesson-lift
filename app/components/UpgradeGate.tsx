"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
// No sparkle glyph: the brand bible bans them alongside wands and gradient
// shimmer, for the same reason it bans the word "AI" in front of a teacher.
import { Medal, Zap, Clock, X } from "lucide-react";
import { PLAN_CREDITS } from "@/app/lib/plans";

// Centralised quota prompt. Rather than editing every tool form, this patches
// window.fetch once and watches for the blocks the server returns when a gate
// refuses a request. On a hit it opens a modal whose copy and CTA come from the
// response body.
//
// Three shapes arrive here (see quotaBlockBody in lib/generation-guard.ts):
//   action: "upgrade" — a free account hit its daily or monthly cap.  402
//   action: "topup"   — a paid account used its monthly AI allowance.  402
//   action: "wait"    — the fair-use rate limit; clears on its own.    429
//
// The "wait" case deliberately offers NO call to action. A Pro teacher who
// generated too quickly has nothing to buy, and showing them an upgrade button
// would be both wrong and irritating.

interface QuotaBlock {
  error?: string;
  action?: "upgrade" | "topup" | "wait";
  reason?: "free_daily" | "free_monthly" | "credit_exhausted" | "rate_limited";
}

export default function UpgradeGate() {
  const [block, setBlock] = useState<QuotaBlock | null>(null);
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    const original = window.fetch;
    window.fetch = async (...args) => {
      const res = await original(...args);
      // 402 + x-upgrade-required is a quota that money fixes; 429 is the
      // fair-use rate limit, which time fixes.
      const isQuota = res.status === 402 && res.headers.get("x-upgrade-required");
      const isRateLimit = res.status === 429;
      if (isQuota || isRateLimit) {
        // MUST clone: the caller still needs to read this body, and json()
        // consumes the stream. Reading the original here would break every
        // tool form's own error handling.
        const body = await res
          .clone()
          .json()
          .catch(() => null);
        setBlock((body as QuotaBlock) ?? { action: "upgrade" });
      }
      return res;
    };
    return () => {
      window.fetch = original;
    };
  }, []);

  async function handleTopUp() {
    setBuying(true);
    try {
      const res = await fetch("/api/stripe/topup", { method: "POST" });
      const data = (await res.json()) as { url?: string };
      if (data.url) {
        window.location.href = data.url; // hand off to Stripe Checkout
        return;
      }
    } catch {
      // fall through — re-enable the button so the user can retry
    }
    setBuying(false);
  }

  if (!block) return null;

  const isTopUp = block.action === "topup";
  const isWait = block.action === "wait" || block.reason === "rate_limited";
  // Derived, not hardcoded, so changing the credit rate can't leave stale copy
  // promising an amount the top-up no longer grants.
  const topUpCredits = PLAN_CREDITS.toLocaleString("en-GB");
  const close = () => setBlock(null);

  const title = isWait
    ? "Just a moment"
    : isTopUp
      ? "You've used this month's AI allowance"
      : block.reason === "free_daily"
        ? "That's your free generation for today"
        : "You've used all your free generations";

  // The server writes copy that already names the real numbers and reset time,
  // so prefer it over anything hardcoded here.
  const message =
    block.error ??
    (isWait
      ? "You've hit the fair-use limit for this hour. Try again shortly."
      : isTopUp
        ? `Add ${topUpCredits} credits for £1.50 to keep going — they last until the end of the month.`
        : "Upgrade to Pro Teacher for £7.99 a month.");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(29,23,48,0.45)" }}
      onClick={close}
    >
      <div
        className="relative w-full max-w-md rounded-2xl p-7 border"
        style={{ backgroundColor: "var(--j-card)", borderColor: "var(--j-line)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute top-4 right-4 p-1 rounded-lg transition-colors hover:bg-black/5"
          style={{ color: "var(--j-faint)" }}
        >
          <X className="w-4 h-4" />
        </button>

        {/* Three tones for three different situations, and the distinction is
            the point: a rate limit clears on its own, a top-up is a small
            purchase, an upgrade is a plan change. Slate, amber, purple. */}
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
          style={{
            backgroundColor: isWait
              ? "var(--j-tint-slate)"
              : isTopUp
                ? "var(--j-tint-amber)"
                : "var(--j-tint)",
          }}
        >
          {isWait ? (
            <Clock className="w-5 h-5" style={{ color: "var(--j-muted)" }} />
          ) : isTopUp ? (
            <Zap className="w-5 h-5" style={{ color: "#b07a1e" }} />
          ) : (
            <Medal className="w-5 h-5" style={{ color: "var(--j-purple)" }} />
          )}
        </div>

        <h2 className="text-lg font-bold tracking-tight mb-1.5" style={{ color: "var(--j-ink)" }}>
          {title}
        </h2>
        <p className="text-sm mb-6" style={{ color: "var(--j-body)" }}>
          {message}
        </p>

        <div className="flex items-center gap-3">
          {/* No CTA for a rate limit: there is nothing to buy, and the block
              clears by itself. Just let them dismiss it. */}
          {isWait ? (
            <button
              type="button"
              onClick={close}
              className="flex-1 text-center py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--j-purple)", color: "#fff" }}
            >
              Got it
            </button>
          ) : isTopUp ? (
            <button
              type="button"
              onClick={handleTopUp}
              disabled={buying}
              className="flex-1 text-center py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ backgroundColor: "var(--j-purple)", color: "#fff" }}
            >
              {buying ? "Starting checkout…" : `Add ${topUpCredits} credits · £1.50`}
            </button>
          ) : (
            <Link
              href="/pricing"
              onClick={close}
              className="flex-1 text-center py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--j-purple)", color: "#fff" }}
            >
              Upgrade to Pro
            </Link>
          )}
          {!isWait && (
            <button
              type="button"
              onClick={close}
              className="py-2.5 px-4 rounded-xl text-sm font-semibold transition-colors hover:bg-black/5"
              style={{ color: "var(--j-muted)" }}
            >
              Maybe later
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
