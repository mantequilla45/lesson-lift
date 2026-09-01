"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { PLAN_CREDITS, TOPUP_PENCE } from "@/app/lib/plans";
import styles from "./TopUpModal.module.css";

/*
 * Top up credits.
 *
 * The prototype offers three fixed packs (500, 1,500 and 4,000 credits). Those
 * are not seeded: each needs a Stripe price, and the live top-up is a single
 * £1.50 grant. So this explains what a top-up is and hands off to the billing
 * page that already runs the Stripe flow, rather than showing three prices
 * nothing can charge.
 *
 * Credits appear here, in the sidebar meter and on the account page. Nowhere
 * else: no per-tool costs on cards, no chips on list rows.
 */

export default function TopUpModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Escape closes, and focus moves into the dialog on open so a keyboard user
  // is not left behind on the page underneath.
  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Scroll lock, matching AppShellV2's drawer.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Rendered through a portal so the dialog is not clipped by the sidebar's
  // `overflow-y: auto`, which is the element it is opened from.
  if (!open || typeof document === "undefined") return null;

  const price = (TOPUP_PENCE / 100).toFixed(2);

  return createPortal(
    <div
      className={styles.scrim}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="topup-title"
        className={styles.modal}
      >
        <h2 id="topup-title" className={styles.title}>
          Top up credits
        </h2>
        <p className={styles.sub}>
          A top up sits on top of your monthly refill and is used first.
        </p>

        <div className={styles.pack}>
          <span className={styles.packName}>
            {PLAN_CREDITS.toLocaleString("en-GB")} credits
          </span>
          <span className={styles.packPrice}>£{price}</span>
        </div>

        <p className={styles.note}>
          Top ups run to the end of the month, alongside your plan allowance.
        </p>

        <div className={styles.foot}>
          <button type="button" className={styles.cancel} onClick={onClose}>
            Not now
          </button>
          <button
            type="button"
            ref={confirmRef}
            className={styles.save}
            onClick={() => {
              onClose();
              router.push("/profile?section=subscription");
            }}
          >
            Continue
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
