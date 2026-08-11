"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Sparkles, Zap, X } from "lucide-react";

// Centralised quota prompt. Rather than editing every tool form, this patches
// window.fetch once and watches for the 402 the server returns when a gate
// blocks a request (tagged with the `x-upgrade-required` header). On a hit it
// opens a modal whose copy and CTA come from the response body.
//
// Two shapes arrive here (see quotaBlockBody in lib/generation-guard.ts):
//   action: "upgrade" — a free account hit its daily or monthly cap.
//   action: "topup"   — a paid account used its monthly AI allowance.

interface QuotaBlock {
  error?: string;
  action?: "upgrade" | "topup";
  reason?: "free_daily" | "free_monthly" | "credit_exhausted";
}

export default function UpgradeGate() {
  const [block, setBlock] = useState<QuotaBlock | null>(null);
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    const original = window.fetch;
    window.fetch = async (...args) => {
      const res = await original(...args);
      if (res.status === 402 && res.headers.get("x-upgrade-required")) {
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
  const close = () => setBlock(null);

  const title = isTopUp
    ? "You've used this month's AI allowance"
    : block.reason === "free_daily"
      ? "That's your free generation for today"
      : "You've used all your free generations";

  // The server writes copy that already names the real numbers and reset time,
  // so prefer it over anything hardcoded here.
  const message =
    block.error ??
    (isTopUp
      ? "Add £1.50 of credit to keep going — it lasts until the end of the month."
      : "Upgrade to Pro Teacher for £7.99 a month.");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(26,26,26,0.45)" }}
      onClick={close}
    >
      <div
        className="relative w-full max-w-md rounded-2xl p-7 border"
        style={{ backgroundColor: "#FAF9F5", borderColor: "#DAD8D0" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute top-4 right-4 p-1 rounded-lg transition-colors hover:bg-black/5"
          style={{ color: "#8a8078" }}
        >
          <X className="w-4 h-4" />
        </button>

        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
          style={{ backgroundColor: isTopUp ? "#FDE8C8" : "#FAD4C8" }}
        >
          {isTopUp ? (
            <Zap className="w-5 h-5" style={{ color: "#b07a1e" }} />
          ) : (
            <Sparkles className="w-5 h-5" style={{ color: "#c25034" }} />
          )}
        </div>

        <h2 className="text-lg font-bold tracking-tight mb-1.5" style={{ color: "#1a1a1a" }}>
          {title}
        </h2>
        <p className="text-sm mb-6" style={{ color: "#6b6055" }}>
          {message}
        </p>

        <div className="flex items-center gap-3">
          {isTopUp ? (
            <button
              type="button"
              onClick={handleTopUp}
              disabled={buying}
              className="flex-1 text-center py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ backgroundColor: "#E0463F", color: "#fff" }}
            >
              {buying ? "Starting checkout…" : "Add £1.50 credit"}
            </button>
          ) : (
            <Link
              href="/pricing"
              onClick={close}
              className="flex-1 text-center py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#E0463F", color: "#fff" }}
            >
              Upgrade to Pro
            </Link>
          )}
          <button
            type="button"
            onClick={close}
            className="py-2.5 px-4 rounded-xl text-sm font-semibold transition-colors hover:bg-black/5"
            style={{ color: "#6b6055" }}
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
