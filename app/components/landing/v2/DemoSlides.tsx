import { DEMO_SLIDE } from "@/app/lib/landing/demo-content";
import styles from "./DemoSlides.module.css";

/**
 * The Slides output: one slide at full size with the rest of the deck as a
 * thumbnail strip beside it.
 *
 * The strip is what sells the tool. A single slide could be anything; five of
 * them says the whole deck arrived, which is the actual claim.
 */
export default function DemoSlides() {
  return (
    <div className={styles.deck}>
      <div className={styles.main}>
        <div className={styles.slide}>
          <span className={styles.rule} />
          <h4>{DEMO_SLIDE.title}</h4>
          <p>{DEMO_SLIDE.body}</p>
          <ul>
            {DEMO_SLIDE.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <div className={styles.activity}>
            <b>{DEMO_SLIDE.activity.label}</b>
            <span>{DEMO_SLIDE.activity.text}</span>
          </div>

          {/* Decorative. The water cycle drawn plainly, in the same warm
              palette as the slide theme. */}
          <svg className={styles.art} viewBox="0 0 200 200" aria-hidden="true">
            <circle cx="150" cy="52" r="26" fill="#F2B23E" />
            <path d="M20 150 Q60 120 100 150 T180 150 L180 200 L20 200 Z" fill="#7FB6C9" />
            <path
              d="M45 118 q10-18 26-12 6-16 24-10 14-10 24 6 16 2 12 18z"
              fill="#DCE6EA"
            />
            <path
              d="M70 128 l-4 16M92 132 l-4 16M114 128 l-4 16"
              stroke="#5B92A8"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <div className={styles.actions}>
          {DEMO_SLIDE.actions.map((action, i) => (
            <span key={action} className={`${styles.action} ${i === 0 ? styles.actionPrimary : ""}`}>
              {action}
            </span>
          ))}
        </div>
      </div>

      <div className={styles.thumbs}>
        {Array.from({ length: DEMO_SLIDE.thumbCount }, (_, i) => i + 1).map((n) => (
          <div key={n} className={`${styles.thumb} ${n === DEMO_SLIDE.activeThumb ? styles.thumbOn : ""}`}>
            <i />
            <i />
            <span>{n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
