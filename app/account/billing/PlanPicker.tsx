"use client";

import { useState } from "react";
import { PLANS, planCredits, type PlanId } from "@/app/lib/plans";

// The plans a teacher can buy, shown inside the Subscription section.
//
// WHY NOT LINK TO /pricing
// It sends someone who is already signed in, already looking at their plan, out
// to a marketing page and back. Worse, /pricing predates Max: it renders two
// hardcoded cards and POSTs to checkout with no body, so it can only ever sell
// Pro. Someone with an account should be able to see and choose every plan from
// the page that is about their account.
//
// The figures are derived — PLANS for the price, planCredits() for the
// allowance — so this cannot advertise an allowance the ceiling will not honour.
// See the note above PENCE_PER_CREDIT in lib/plans.ts.

/** What each plan is worth saying, beyond its price and credit count. The
 *  wording matches plan_config.description and the live pricing page. */
/** Button label per plan. The card heading already names the plan, so
 *  "Choose Pro Teacher" says it twice. */
const CTA: Record<string, string> = {
  pro: "Go Pro",
  max: "Choose Max",
};

const HIGHLIGHTS: Record<string, string[]> = {
  pro: [
    "Full curriculum alignment",
    "Clean exports, no watermark",
    "Refining is always free",
    "Top up any time",
  ],
  max: ["Priority building", "Everything in Pro"],
};

export default function PlanPicker({
  /** Plans to offer, cheapest first. Free is never among them. */
  plans,
  /** The teacher's current plan, so the card they are on is marked. */
  current,
}: {
  plans: PlanId[];
  current: PlanId;
}) {
  const [pending, setPending] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function subscribe(plan: PlanId) {
    setPending(plan);
    setError(null);
    try {
      // Checkout, not the upgrade route: this renders for teachers with no
      // subscription to swap. Someone who already subscribes gets UpgradeButton
      // on the Overview card instead, which changes their existing plan rather
      // than starting a second one.
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        // assign(), not `location.href =`: a full navigation to Stripe's
        // domain either way, but the React compiler reads the property write as
        // mutating a value from outside the component.
        window.location.assign(data.url);
        return;
      }
      setError(data.error ?? "Could not start checkout.");
    } catch {
      setError("Network error. Please try again.");
    }
    // Only reached if checkout did not open, so the button can be retried.
    setPending(null);
  }

  return (
    <div className="mt-5">
      <p className="text-sm font-semibold mb-3" style={{ color: "var(--j-ink)" }}>
        Upgrade your plan
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {plans.map((id) => {
          const plan = PLANS[id];
          const credits = planCredits(id);
          const isCurrent = id === current;

          return (
            <div
              key={id}
              className="rounded-2xl p-5 border flex flex-col"
              style={{
                backgroundColor: "var(--j-card)",
                borderColor: isCurrent ? "var(--j-purple)" : "var(--j-line)",
              }}
            >
              <div className="flex items-baseline justify-between mb-1">
                <p className="text-sm font-bold" style={{ color: "var(--j-ink)" }}>
                  {plan.name}
                </p>
                {isCurrent && (
                  <span
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: "var(--j-tint)", color: "var(--j-purple)" }}
                  >
                    Current
                  </span>
                )}
              </div>

              <p className="mb-3">
                <span className="text-2xl font-bold" style={{ color: "var(--j-ink)" }}>
                  £{plan.priceMonthly?.toFixed(2)}
                </span>
                <span className="text-sm font-medium" style={{ color: "var(--j-faint)" }}>
                  {" "}
                  a month
                </span>
              </p>

              <ul className="text-sm space-y-1.5 mb-4 flex-1" style={{ color: "var(--j-body)" }}>
                {credits !== null && (
                  <li className="font-medium" style={{ color: "var(--j-ink)" }}>
                    {credits.toLocaleString("en-GB")} credits a month
                  </li>
                )}
                {(HIGHLIGHTS[id] ?? []).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => subscribe(id)}
                disabled={pending !== null || isCurrent}
                className="w-full py-2.5 px-5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                style={{ backgroundColor: "var(--j-purple)", color: "#fff" }}
              >
                {pending === id
                  ? "Starting checkout…"
                  : isCurrent
                    ? "Your plan"
                    : (CTA[id] ?? `Choose ${plan.name}`)}
              </button>
            </div>
          );
        })}
      </div>

      {error && (
        <p className="text-sm mt-3" role="alert" style={{ color: "#c2342b" }}>
          {error}
        </p>
      )}

      {/* Schools are sold hands-on, not self-serve: there is no seat model on
          profiles to bill against, so this is an enquiry, not a card. */}
      <p className="text-sm mt-4" style={{ color: "var(--j-faint)" }}>
        Running a whole school?{" "}
        <a
          href="mailto:schools@jooma.ai"
          className="font-semibold underline transition-opacity hover:opacity-70"
          style={{ color: "var(--j-purple)" }}
        >
          Talk to us
        </a>{" "}
        about school pricing.
      </p>
    </div>
  );
}
