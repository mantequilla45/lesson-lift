import Link from "next/link";
import Reveal from "./Reveal";
import shared from "./landing.module.css";
import styles from "./Showcase.module.css";

/**
 * A two column feature section: copy on one side, a visual on the other.
 *
 * `reverse` alternates which side the copy sits on down the page. On a phone
 * both orders collapse to copy-then-visual, so the reversed section does not
 * lead with a picture whose caption is below the fold.
 */
export default function Showcase({
  eyebrow,
  title,
  lede,
  points,
  cta,
  reverse = false,
  alt = false,
  children,
  bare = false,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  points: string[];
  cta: { href: string; label: string };
  reverse?: boolean;
  /** Sit the section on the tinted band rather than the page ground. */
  alt?: boolean;
  /** Render the visual without the standard white card around it. */
  bare?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`${shared.sec} ${alt ? shared.secAlt : ""}`}>
      <Reveal className={`${shared.shell} ${styles.show} ${reverse ? styles.reverse : ""}`}>
        <div className={styles.copy}>
          <span className={shared.eyebrow}>{eyebrow}</span>
          <h2>{title}</h2>
          <p className={shared.lede}>{lede}</p>
          <ul className={styles.list}>
            {points.map((point) => (
              <li key={point}>
                <span className={shared.tick} aria-hidden="true">
                  &#10003;
                </span>
                {point}
              </li>
            ))}
          </ul>
          <div className={styles.cta}>
            <Link href={cta.href} className={`${shared.btn} ${shared.btnP}`}>
              {cta.label}
            </Link>
          </div>
        </div>

        <div className={bare ? styles.visualBare : styles.visual}>{children}</div>
      </Reveal>
    </section>
  );
}
