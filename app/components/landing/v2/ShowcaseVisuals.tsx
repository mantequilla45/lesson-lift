import { ChatTeardropDots } from "@phosphor-icons/react/dist/ssr";
import slides from "./DemoSlides.module.css";
import comp from "./DemoComprehension.module.css";
import styles from "./ShowcaseVisuals.module.css";

/**
 * The three showcase visuals.
 *
 * PLACEHOLDER content, like the hero demo: written by hand to be
 * representative, to be replaced with real Jooma output.
 */

/** A finished slide, for the Slides showcase. */
export function SlidePreview() {
  return (
    <>
      <div className={slides.slide} style={{ minHeight: 270 }}>
        <span className={slides.rule} />
        <h4>Reflections on multiplication</h4>
        <p>We have uncovered the layers of multiplication through place value.</p>
        <ul>
          <li>
            <b>Place value</b> is the foundation
          </li>
          <li>
            <b>Columns</b> keep us accurate
          </li>
          <li>
            <b>Partitioning</b> breaks down big tasks
          </li>
        </ul>
        <div className={slides.activity}>
          <b>Question for next time</b>
          <span>How can place value help with efficient addition?</span>
        </div>
      </div>

      <div className={styles.strip}>
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className={`${slides.thumb} ${n === 3 ? slides.thumbOn : ""} ${styles.stripCell}`}>
            <i />
            <i />
          </div>
        ))}
      </div>
    </>
  );
}

/** An original text at a stated reading age, for the Comprehension showcase. */
export function ReadingPreview() {
  return (
    <div className={styles.reading}>
      <h4>The lighthouse keeper</h4>
      <p className={comp.source}>Age 9, expected for Year 4</p>
      <p className={comp.para}>
        Every evening, before the light failed, Maren climbed the ninety seven steps to the lamp
        room. The wind pushed against the glass as though it wanted to come in.
      </p>
      <p className={comp.para}>
        She had kept the lamp burning for thirty one winters. In all that time, not one ship had
        struck the rocks below.
      </p>
      <div className={comp.questions}>
        <b>Questions</b>
        <ol>
          <li>How many steps did Maren climb?</li>
          <li>Find a word that shows the wind was strong.</li>
          <li>Why do you think the writer mentions the ships?</li>
        </ol>
      </div>
    </div>
  );
}

/**
 * The Ask Mo exchange.
 *
 * Note what Mo does here: it does not generate. It asks a clarifying question,
 * offers two concrete options and an escape hatch, and says what it already
 * knows about the class. That behaviour is the product claim, so the example
 * has to show it rather than showing a finished answer.
 */
export function MoChat() {
  return (
    <div className={styles.chat}>
      <div className={styles.line}>
        <span className={`${styles.who} ${styles.you}`} aria-hidden="true">
          AA
        </span>
        <div className={styles.text}>
          I need a Year 4 maths lesson on equivalent fractions for Friday, mixed ability class of 30.
        </div>
      </div>

      <div className={styles.line}>
        <span className={`${styles.who} ${styles.bot}`} aria-hidden="true">
          <ChatTeardropDots weight="fill" className={styles.whoGlyph} />
        </span>
        <div className={styles.text}>
          Happy to. Before I build it, two quick things.
          <br />
          <br />
          You taught halves and quarters last term, so I will pitch the starter as retrieval on that
          rather than starting cold. <b>Do you want the fraction wall investigation, or something
          more practical with paper folding?</b>
          <div className={styles.options}>
            <span>Fraction wall</span>
            <span>Paper folding</span>
            <span>Just build it</span>
          </div>
        </div>
      </div>
    </div>
  );
}
