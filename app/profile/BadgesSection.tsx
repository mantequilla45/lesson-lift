"use client";

import BadgeMedallion from "@/app/components/v2/BadgeMedallion";
import { BADGE_LEVELS, TOTAL_BADGES } from "@/app/lib/badges";
import { useBadgeProgress } from "@/app/lib/useBadgeProgress";
import styles from "./badges.module.css";

/*
 * The badge collection.
 *
 * A client component, unlike the rest of this page's sections: what is earned is
 * per-teacher and arrives from the shared badge store, and there is no server
 * fetch being given up by moving it (the catalogue is a static import).
 *
 * Two things stay from the version that could show nothing.
 *
 * The descriptions are text on the page rather than tooltips, because the
 * description is the badge's whole point and a tooltip is unreachable on a phone
 * and invisible to a screen reader that is not hovering.
 *
 * And there is no "0 of 100" headline on a new account. A zero as the first
 * thing you read is discouraging, and it is a worse description of a teacher who
 * signed up yesterday than simply saying what there is to collect.
 */
export default function BadgesSection() {
  const { earned, earnedCount, available, loading, total } = useBadgeProgress();

  const lede = !available
    ? `${TOTAL_BADGES} badges across ${BADGE_LEVELS.length} levels, earned for the teaching habits worth building. None are collectable yet, so these are the ones to come.`
    : earnedCount === 0
      ? `${TOTAL_BADGES} badges across ${BADGE_LEVELS.length} levels, earned for the teaching habits worth building. Make something and the first will be along shortly.`
      : `${earnedCount} of ${total} collected across ${BADGE_LEVELS.length} levels.`;

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <h2 className={styles.title}>Badges</h2>
        <p className={styles.lede}>{loading ? "Counting them up." : lede}</p>
      </header>

      {BADGE_LEVELS.map((level) => {
        const got = level.badges.filter((b) => earned.has(b.id)).length;
        return (
          <section key={level.level} className={styles.level}>
            <div className={styles.levelHead}>
              <span className={styles.levelNo}>Level {level.level}</span>
              <h3 className={styles.levelTitle}>{level.title}</h3>
              {got > 0 && (
                <span className={styles.levelCount}>
                  {got} of {level.badges.length} in this level
                </span>
              )}
            </div>

            <ul className={styles.grid}>
              {level.badges.map((badge) => {
                const earnedAt = earned.get(badge.id);
                return (
                  <li key={badge.id} className={styles.badge}>
                    <span className={styles.medal}>
                      <BadgeMedallion
                        icon={badge.icon}
                        tier={level.tier}
                        locked={!earnedAt}
                        /* Unique per medallion: two on one page otherwise share a
                           gradient id and the second inherits the first's colours. */
                        uid={badge.id}
                      />
                    </span>
                    <span className={styles.badgeText}>
                      <b className={styles.badgeName}>{badge.name}</b>
                      <span className={styles.badgeDesc}>{badge.description}</span>
                      {earnedAt ? (
                        <span className={styles.earned}>
                          Earned{" "}
                          {new Date(earnedAt).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "long",
                          })}
                        </span>
                      ) : badge.pending ? (
                        /* Not "you have not done this": the thing it measures
                           does not exist to be done. Saying so is the difference
                           between a goal and a dead end. */
                        <span className={styles.soon}>Soon</span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
