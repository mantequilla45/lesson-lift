"use client";

import { useState } from "react";
import {
  DEMO_COMPREHENSION,
  DEMO_COMPREHENSION_TITLE,
  READING_AGES,
  type ReadingAge,
} from "@/app/lib/landing/demo-content";
import styles from "./DemoComprehension.module.css";

/**
 * The Comprehension output, with the reading age switcher.
 *
 * This is the most persuasive thing on the page. Differentiation is hard to
 * describe and instant to demonstrate: one press rewrites both the passage and
 * the questions, which is exactly the job a mixed ability teacher is doing at
 * ten to nine. Keep it.
 */
export default function DemoComprehension() {
  const [age, setAge] = useState<ReadingAge>(7);
  const content = DEMO_COMPREHENSION[age];
  const source = READING_AGES.find((a) => a.age === age)!.source;

  return (
    <div className={styles.comp}>
      <div className={styles.reading}>
        <h4>{DEMO_COMPREHENSION_TITLE}</h4>
        <p className={styles.source}>{source}</p>

        {/* Announced politely so a screen reader hears the passage change
            rather than silently reading a stale text. */}
        <div aria-live="polite">
          {content.paragraphs.map((paragraph) => (
            <p key={paragraph} className={styles.para}>
              {paragraph}
            </p>
          ))}

          <div className={styles.questions}>
            <b>Questions</b>
            <ol>
              {content.questions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      <div className={styles.control}>
        <h4>Same text, any reading age</h4>
        <label className={styles.label} id="reading-age-label">
          Reading age
        </label>
        <div className={styles.ages} role="group" aria-labelledby="reading-age-label">
          {READING_AGES.map((option) => (
            <button
              key={option.age}
              type="button"
              aria-pressed={age === option.age}
              className={`${styles.age} ${age === option.age ? styles.ageOn : ""}`}
              onClick={() => setAge(option.age)}
            >
              {option.label}
              <span>{option.note}</span>
            </button>
          ))}
        </div>
        <p className={styles.hint}>
          One class, three reading ages, one press. The questions rewrite themselves too.
        </p>
      </div>
    </div>
  );
}
