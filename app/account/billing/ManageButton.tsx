"use client";

import { useState } from "react";

// Opens the Stripe Billing Portal. Server creates the session; we redirect.
//
// One component for all three portal buttons (Manage billing / Update card /
// Cancel subscription) because they differ only in the POST body and the label
// — the fetch, the error handling and the redirect are identical, and three
// copies of that would drift.

/** Must match ALLOWED_FLOWS in app/api/stripe/portal/route.ts. */
export type PortalFlow = "payment_method_update" | "subscription_cancel";

/**
 * `dark` is the primary action. `outline` is available-but-secondary.
 *
 * `danger` is deliberately an OUTLINE, not a filled #E0463F: that red is this
 * palette's primary-action colour (it's on "Upgrade to Pro" and "Add credits"),
 * so a filled red Cancel button would be the loudest thing on the page and read
 * as the thing we want you to press.
 */
type Variant = "dark" | "outline" | "danger";

const VARIANTS: Record<Variant, React.CSSProperties> = {
  dark: { backgroundColor: "#1a1a1a", color: "#fff" },
  outline: { backgroundColor: "transparent", color: "#1a1a1a", border: "1px solid #DAD8D0" },
  danger: { backgroundColor: "transparent", color: "#E0463F", border: "1px solid #E0463F" },
};

export default function ManageButton({
  flow,
  label = "Manage billing",
  busyLabel = "Opening…",
  variant = "dark",
}: {
  /** Omit for the generic portal homepage (where invoice history lives). */
  flow?: PortalFlow;
  label?: string;
  busyLabel?: string;
  variant?: Variant;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    setLoading(true);
    setError(null);
    try {
      // No flow → no body at all, matching the request this route has always
      // received. The route tolerates an empty body precisely so this stays
      // true; don't "tidy" it into sending {}.
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        ...(flow
          ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ flow }) }
          : {}),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error ?? "Could not open the billing portal.");
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
        onClick={openPortal}
        disabled={loading}
        className="inline-block py-2.5 px-5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        style={VARIANTS[variant]}
      >
        {loading ? busyLabel : label}
      </button>
      {error && (
        <p className="text-sm mt-2" style={{ color: "#c2342b" }}>
          {error}
        </p>
      )}
    </div>
  );
}
