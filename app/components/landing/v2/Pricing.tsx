"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Reveal from "./Reveal";
import shared from "./landing.module.css";
import styles from "./Pricing.module.css";

export interface PlanCard {
  id: "free" | "pro" | "max" | "school";
  name: string;
  price: string;
  per: string;
  features: string[];
  cta: string;
  /** The purple, most-prominent card. */
  featured?: boolean;
  /** Starts a Stripe checkout for this plan instead of following a link. */
  checkout?: "pro" | "max";
  href?: string;
}

/**
 * The pricing table.
 *
 * The figures are passed in from the server, derived from PLANS, so they cannot
 * drift from what is actually charged and granted.
 *
 * Free is described by what it really is: five resources a month, one a day.
 * The V2 prototype offered "one hundred credits a month" here, which no signup
 * receives.
 */
export default function Pricing({ plans }: { plans: PlanCard[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout(plan: "pro" | "max") {
    setPending(plan);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      // Nobody can subscribe without an account, so send them to sign up and
      // bring them back here afterwards rather than failing silently.
      if (res.status === 401) {
        router.push(`/signup?plan=${plan}`);
        return;
      }

      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error ?? "Something went wrong. Please try again.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <section className={`${shared.sec} ${shared.secAlt}`} id="pricing">
      <div className={shared.shell}>
        <Reveal className={`${shared.secHead} ${shared.secHeadCentre}`}>
          <span className={shared.eyebrow}>Pricing</span>
          <h2>Start free. Upgrade when it has already saved you a Sunday.</h2>
        </Reveal>

        <Reveal className={styles.plans}>
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`${styles.plan} ${plan.featured ? styles.featured : ""}`}
              // The Schools card is the anchor target for the Schools nav link.
              id={plan.id === "school" ? "schools" : undefined}
            >
              {plan.featured && <span className={styles.badge}>Most popular</span>}
              <h3>{plan.name}</h3>
              <p className={styles.price}>{plan.price}</p>
              <p className={styles.per}>{plan.per}</p>
              <ul className={styles.features}>
                {plan.features.map((feature) => (
                  <li key={feature}>
                    <span className={shared.tick} aria-hidden="true">
                      &#10003;
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>

              {plan.checkout ? (
                <button
                  type="button"
                  disabled={pending !== null}
                  onClick={() => startCheckout(plan.checkout!)}
                  className={`${shared.btn} ${plan.featured ? shared.btnW : shared.btnG} ${styles.action}`}
                >
                  {pending === plan.checkout ? "Starting..." : plan.cta}
                </button>
              ) : (
                <Link
                  href={plan.href ?? "/signup"}
                  className={`${shared.btn} ${plan.featured ? shared.btnW : shared.btnG} ${styles.action}`}
                >
                  {plan.cta}
                </Link>
              )}
            </div>
          ))}
        </Reveal>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <p className={styles.note}>
          Prices include VAT. Cancel any time, see our refund policy.
        </p>
      </div>
    </section>
  );
}
