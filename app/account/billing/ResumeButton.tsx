"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Clears a scheduled cancellation so the subscription renews again.
//
// Deliberately NOT part of ManageButton: that component's whole job is to open
// a Stripe-hosted portal session and redirect to it. This one calls our own
// API, stays on the page, and refreshes the server component to pick up the new
// state — different shape, so folding them together would mean a component that
// sometimes navigates away and sometimes doesn't.
export default function ResumeButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resume() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/resume", { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok) {
        // Re-render the server component so the card flips back to
        // "Renews on …" without a full page reload.
        router.refresh();
        return;
      }
      setError(data.error ?? "Could not renew your subscription.");
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
        onClick={resume}
        disabled={loading}
        className="inline-block py-2.5 px-5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        style={{ backgroundColor: "var(--j-purple)", color: "#fff" }}
      >
        {loading ? "Renewing…" : "Renew subscription"}
      </button>
      {error && (
        <p className="text-sm mt-2" style={{ color: "#c2342b" }}>
          {error}
        </p>
      )}
    </div>
  );
}
