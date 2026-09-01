import Link from "next/link";
import Reveal from "./Reveal";
import shared from "./landing.module.css";
import styles from "./ClosingCta.module.css";

export default function ClosingCta() {
  return (
    <div className={shared.shell}>
      <Reveal className={styles.close} as="section">
        <h2>Let&apos;s give teachers their evenings back.</h2>
        {/* The real free offer: five resources a month, one a day. Not the
            "hundred credits" the prototype promised, which no signup gets. */}
        <p>Five free resources a month. No card, no trial running out.</p>
        <div className={styles.row}>
          <Link href="/signup" className={`${shared.btn} ${shared.btnW}`}>
            Start free
          </Link>
          <a href="mailto:schools@jooma.ai" className={`${shared.btn} ${shared.btnO}`}>
            Book a school demo
          </a>
        </div>
        <small>Set up in under a minute</small>
      </Reveal>
    </div>
  );
}
