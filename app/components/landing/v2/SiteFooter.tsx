import Link from "next/link";
import Wordmark from "./Wordmark";
import shared from "./landing.module.css";
import styles from "./SiteFooter.module.css";

/**
 * Every link here goes somewhere real.
 *
 * The old footer carried eleven dead `href="#"` links across Company and
 * Resources columns. A footer full of links that do nothing is worse than a
 * short one, so this lists only pages that exist, plus /refunds.
 *
 * /refunds does NOT exist yet and Stripe will ask for it. The link stays so the
 * gap is visible rather than forgotten. When that page is built it must also be
 * added to PUBLIC_PATHS in proxy.ts, or it will bounce a signed-out visitor to
 * the login page.
 */
const COLUMNS = [
  {
    heading: "Product",
    links: [
      { href: "#try", label: "Try it" },
      { href: "#tools", label: "Tools" },
      { href: "#pricing", label: "Pricing" },
      { href: "#schools", label: "For schools" },
    ],
  },
  {
    heading: "Company",
    links: [
      { href: "mailto:support@jooma.ai", label: "Contact" },
      { href: "mailto:schools@jooma.ai", label: "School enquiries" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: "/refunds", label: "Refunds and cancellation" },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className={styles.foot}>
      <div className={shared.shell}>
        <div className={styles.grid}>
          <div>
            <Link href="/" className={styles.brand} aria-label="Jooma">
              <Wordmark />
            </Link>
            <p className={styles.blurb}>
              Teaching resources built around the UK curriculum, by people who have taught.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.heading}>
              <h4>{column.heading}</h4>
              <ul>
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith("/") ? (
                      <Link href={link.href}>{link.label}</Link>
                    ) : (
                      <a href={link.href}>{link.label}</a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className={styles.base}>
          <span>&copy; {new Date().getFullYear()} Jooma. All rights reserved.</span>
          <span>Made in the UK</span>
        </div>
      </div>
    </footer>
  );
}
