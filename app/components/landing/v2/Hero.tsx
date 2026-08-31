import HeroDemo from "./HeroDemo";
import shared from "./landing.module.css";
import styles from "./Hero.module.css";

/**
 * The hero.
 *
 * The heading is split so the second clause carries the purple: the promise is
 * "walk out with the lesson", not "type a topic", and the colour puts the
 * emphasis on the outcome rather than the input.
 *
 * Copy comes from /admin/copy so it can be edited without a deploy.
 */
export default function Hero({
  eyebrow,
  headline,
  sub,
  reassure,
}: {
  eyebrow: string;
  headline: string;
  sub: string;
  reassure: string;
}) {
  // The editable string is one sentence pair; the accent falls on the second.
  const [lead, ...rest] = headline.split(/(?<=\.)\s+/);
  const accent = rest.join(" ");

  return (
    <section className={styles.hero} id="try">
      <div className={shared.shell}>
        <div className={styles.top}>
          <span className={shared.eyebrow}>{eyebrow}</span>
          <h1>
            {lead}
            {accent && (
              <>
                {" "}
                <span className={styles.accent}>{accent}</span>
              </>
            )}
          </h1>
        </div>

        <p className={styles.sub}>{sub}</p>

        <HeroDemo />

        <p className={styles.note}>{reassure}</p>
      </div>
    </section>
  );
}
