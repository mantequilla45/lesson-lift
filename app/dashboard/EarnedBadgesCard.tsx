"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { X } from "@phosphor-icons/react/dist/ssr";
import BadgeMedallion from "@/app/components/v2/BadgeMedallion";
import { badgeById, levelForBadge } from "@/app/lib/badges";
import { dismissJustEarned } from "@/app/lib/useBadgeProgress";
import styles from "./EarnedBadgesCard.module.css";

/*
 * "You earned this."
 *
 * A card in the page rather than a toast, for three reasons.
 *
 * Badges are granted when the dashboard next loads and evaluates the teacher's
 * history, not at the moment of the action that earned them. A toast implies
 * immediacy and would pop up about something done yesterday, at a moment with
 * no connection to it. A card that sits in the page reads correctly as "here is
 * what is new since you were last here".
 *
 * Several land at once more often than not — a first resource is usually also a
 * first save and a first week — and three stacked toasts is a pile-on where
 * three rows in one card is a nice moment.
 *
 * And it needs no global machinery: no portal, no provider, no queue, no timing,
 * no live region to get right. There is no toast system in this app, and a
 * cosmetic reward is not the thing to build one for.
 *
 * Dismissal is remembered for the session so it does not reappear on every
 * navigation back to Today. sessionStorage rather than a column: this is a
 * per-tab presentation detail, not something the account needs to remember.
 */

const DISMISSED_KEY = "jooma-badges-seen";

/*
 * What has already been dismissed, as an external store.
 *
 * sessionStorage IS an external system, so this is what useSyncExternalStore is
 * for: reading it in an effect and calling setState would cause the cascading
 * render the lint rule warns about, and reading it during render would differ
 * between the server and the client and break hydration. The snapshot is cached
 * so it stays referentially stable, or the hook would loop.
 */
let seenSnapshot: string | null = null;
let seenRead = false;
const seenListeners = new Set<() => void>();

function readSeen(): string | null {
  if (!seenRead) {
    seenRead = true;
    try {
      seenSnapshot = sessionStorage.getItem(DISMISSED_KEY);
    } catch {
      // Private mode, or storage disabled. Showing the card again is a much
      // smaller problem than failing to render it.
      seenSnapshot = null;
    }
  }
  return seenSnapshot;
}

function subscribeSeen(callback: () => void): () => void {
  seenListeners.add(callback);
  return () => {
    seenListeners.delete(callback);
  };
}

/** null on the server, where there is no session storage to read. */
const seenOnServer = () => null;

export default function EarnedBadgesCard({ ids }: { ids: string[] }) {
  const seen = useSyncExternalStore(subscribeSeen, readSeen, seenOnServer);

  const alreadySeen =
    seen !== null && ids.length > 0 && ids.every((id) => seen.split(",").includes(id));

  if (ids.length === 0 || alreadySeen) return null;

  const badges = ids.flatMap((id) => {
    const badge = badgeById(id);
    return badge ? [{ badge, tier: levelForBadge(id)?.tier ?? "bronze" }] : [];
  });
  if (badges.length === 0) return null;

  const close = () => {
    const value = ids.join(",");
    seenSnapshot = value;
    seenRead = true;
    try {
      sessionStorage.setItem(DISMISSED_KEY, value);
    } catch {
      // Nothing to do. It reappears next visit at worst.
    }
    seenListeners.forEach((l) => l());
    dismissJustEarned();
  };

  return (
    <section className={styles.card} aria-labelledby="earned-heading">
      <div className={styles.head}>
        <h2 id="earned-heading" className={styles.title}>
          {badges.length === 1 ? "New badge" : `${badges.length} new badges`}
        </h2>
        <button
          type="button"
          onClick={close}
          className={styles.close}
          aria-label="Dismiss"
        >
          <X weight="bold" />
        </button>
      </div>

      <ul className={styles.list}>
        {badges.map(({ badge, tier }) => (
          <li key={badge.id} className={styles.row}>
            <span className={styles.medal}>
              <BadgeMedallion icon={badge.icon} tier={tier} uid={`new-${badge.id}`} />
            </span>
            <span className={styles.text}>
              <b className={styles.name}>{badge.name}</b>
              <span className={styles.desc}>{badge.description}</span>
            </span>
          </li>
        ))}
      </ul>

      <Link href="/profile?section=badges" className={styles.link}>
        See your collection
      </Link>
    </section>
  );
}
