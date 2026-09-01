import Link from "next/link";
import Wordmark from "@/app/components/v2/Wordmark";
import styles from "./AuthLayout.module.css";

/*
 * The shared frame for the five auth pages: sign in, sign up, verify, create a
 * password, and complete a profile.
 *
 * There is no prototype for these, so they follow the landing page's
 * conventions instead: the V2 tokens, Plus Jakarta Sans, and the purple brand.
 *
 * Before this, each page hand-rolled the same split panel with its own literal
 * hexes, which is how the five had already drifted apart. The panel, the
 * fields, the buttons and the two message tones all live here now.
 */

export default function AuthLayout({
  title,
  lede,
  children,
  footer,
}: {
  /** The headline. Kept short: two lines at most. */
  title: React.ReactNode;
  /** One line under it. */
  lede?: React.ReactNode;
  children: React.ReactNode;
  /** The "already have an account?" line at the bottom. */
  footer?: React.ReactNode;
}) {
  return (
    // `jooma-v2` is what puts the --j-* tokens in scope. Without it on the
    // wrapper the whole page renders with unresolved variables.
    <div className={`jooma-v2 ${styles.page}`}>
      <div className={styles.shell}>
        {/* The brand side. Purely decorative, so it is hidden rather than
            stacked on a phone: a teacher on a small screen wants the form. */}
        <aside className={styles.brand} aria-hidden="true">
          <div className={styles.brandInner}>
            <Wordmark height={30} />
            <p className={styles.brandLine}>
              Planning, resources and marking support, built for the classroom
              you actually teach in.
            </p>
            <ul className={styles.brandList}>
              <li>35 tools, made for the English curriculum</li>
              <li>Differentiated for the range in front of you</li>
              <li>Everything you make stays yours to edit</li>
            </ul>
          </div>
        </aside>

        <main className={styles.panel}>
          <div className={styles.form}>
            {/* The wordmark repeats here for the phone layout, where the brand
                panel is not rendered at all. */}
            <Link href="/" className={styles.mark} aria-label="Jooma, go to the home page">
              <Wordmark height={28} />
            </Link>

            <div className={styles.head}>
              <h1>{title}</h1>
              {lede && <p className={styles.lede}>{lede}</p>}
            </div>

            {children}

            {footer && <p className={styles.footer}>{footer}</p>}
          </div>
        </main>
      </div>
    </div>
  );
}
