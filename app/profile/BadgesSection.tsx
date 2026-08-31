import BadgeMedallion from "@/app/components/v2/BadgeMedallion";
import { BADGE_LEVELS, TOTAL_BADGES } from "@/app/lib/badges";
import styles from "./badges.module.css";

/*
 * The badge collection.
 *
 * Every medallion is locked, because there is no `badges` table and no
 * `user_badges` table yet: nothing can be earned, so nothing is shown as
 * earned. The alternative was to hide the section until the data exists, but a
 * teacher seeing what is coming is worth more than a page that appears from
 * nowhere later, and the shape is what makes the levels legible.
 *
 * Deliberately no "0 of 100" headline. A zero as the first thing you read is
 * discouraging and, here, would be reporting on a feature that has not started
 * rather than on anything the teacher did or did not do.
 */
export default function BadgesSection() {
  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <h2 className={styles.title}>Badges</h2>
        <p className={styles.lede}>
          {TOTAL_BADGES} badges across {BADGE_LEVELS.length} levels, earned for
          the teaching habits worth building. None are collectable yet, so these
          are the ones to come.
        </p>
      </header>

      {BADGE_LEVELS.map((level) => (
        <section key={level.level} className={styles.level}>
          <div className={styles.levelHead}>
            <span className={styles.levelNo}>Level {level.level}</span>
            <h3 className={styles.levelTitle}>{level.title}</h3>
          </div>

          <ul className={styles.grid}>
            {level.badges.map((badge) => (
              // The description is the badge's whole point, so it is text on the
              // page rather than a title attribute: a tooltip is unreachable on
              // a phone and invisible to a screen reader that is not hovering.
              <li key={badge.id} className={styles.badge}>
                <span className={styles.medal}>
                  <BadgeMedallion
                    icon={badge.icon}
                    tier={level.tier}
                    locked
                    /* Unique per medallion: two on one page otherwise share a
                       gradient id and the second inherits the first's colours. */
                    uid={badge.id}
                  />
                </span>
                <span className={styles.badgeText}>
                  <b className={styles.badgeName}>{badge.name}</b>
                  <span className={styles.badgeDesc}>{badge.description}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
