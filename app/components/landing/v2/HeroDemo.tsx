"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/app/lib/usePrefersReducedMotion";
import {
  BUILD_STEPS,
  DEMO_CHIPS,
  DEMO_TABS,
  DEMO_TOPIC,
  REVEAL_MS,
  STEP_MS,
  type DemoTabId,
} from "@/app/lib/landing/demo-content";
import { ToolTile } from "@/app/components/v2/Squircle";
import DemoSlides from "./DemoSlides";
import DemoComprehension from "./DemoComprehension";
import DemoWorksheet from "./DemoWorksheet";
import styles from "./HeroDemo.module.css";

/**
 * The hero demo.
 *
 * A teacher has to understand the product within about four seconds of
 * landing, so this runs itself: the Slides build starts on mount, without
 * anyone pressing anything.
 *
 * The build sequence is theatre, but honest theatre. The five steps name real
 * stages of the work, and the outputs are representative of what the tools
 * return. They are hardcoded (see demo-content.ts) rather than generated live:
 * this is the highest traffic page on the site, and a real call here would need
 * hard rate limiting and would risk a slow first impression.
 */
export default function HeroDemo() {
  const [tab, setTab] = useState<DemoTabId>("slides");
  const [topic, setTopic] = useState(DEMO_TOPIC);
  /** Which build step is currently running. -1 once the output is showing. */
  const [step, setStep] = useState(0);
  const [building, setBuilding] = useState(true);

  const reduceMotion = usePrefersReducedMotion();

  // Every timer for the run in flight, so a new run can cancel the old one
  // rather than letting two sequences interleave and fight over `step`.
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  /**
   * Schedules the ticks for a run that is already in the building state.
   *
   * Only ever called from an effect, and only ever schedules: it sets no state
   * synchronously, so starting a run never causes a cascading render.
   */
  const schedule = useCallback(() => {
    clearTimers();

    // Reduced motion goes straight to the result. The point of the demo is the
    // output, not the wait, so there is nothing to lose by skipping it.
    if (reduceMotion) {
      timers.current.push(
        setTimeout(() => {
          setBuilding(false);
          setStep(-1);
        }, 0),
      );
      return;
    }

    BUILD_STEPS.forEach((_, i) => {
      timers.current.push(setTimeout(() => setStep(i + 1), STEP_MS * (i + 1)));
    });

    timers.current.push(
      setTimeout(
        () => {
          setBuilding(false);
          setStep(-1);
        },
        STEP_MS * BUILD_STEPS.length + REVEAL_MS,
      ),
    );
  }, [reduceMotion]);

  /**
   * Bumped to start a run. The effect below watches it, so every trigger (the
   * tab buttons, the Make it button, Enter in the field, a suggestion chip)
   * goes through exactly one code path, and a rapid second press restarts the
   * sequence cleanly instead of interleaving two of them.
   */
  const [runId, setRunId] = useState(0);

  // Runs Slides on mount, and again on every tab change or rerun.
  useEffect(() => {
    schedule();
    return clearTimers;
  }, [tab, runId, schedule]);

  function rerun() {
    setBuilding(true);
    setStep(0);
    setRunId((n) => n + 1);
  }

  function pickChip(chip: string) {
    setTopic(chip);
    rerun();
  }

  function pickTab(next: DemoTabId) {
    setBuilding(true);
    setStep(0);
    setTab(next);
  }

  return (
    <div className={styles.demo}>
      <div className={styles.bar}>
        <span className={styles.dots} aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className={styles.url}>jooma.ai</span>
        <span className={styles.live}>
          <i aria-hidden="true" /> Try it here
        </span>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Choose what to make">
        {DEMO_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`${styles.tab} ${tab === t.id ? styles.tabOn : ""}`}
            onClick={() => pickTab(t.id)}
          >
            <ToolTile icon={t.icon} solid={t.solid} size="tab" />
            {t.label}
          </button>
        ))}
      </div>

      <div className={styles.input}>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") rerun();
          }}
          aria-label="Topic"
        />
        <button type="button" className={styles.go} onClick={rerun}>
          Make it
        </button>
      </div>

      <div className={styles.chips}>
        {DEMO_CHIPS.map((chip) => (
          <button key={chip} type="button" className={styles.chip} onClick={() => pickChip(chip)}>
            {chip}
          </button>
        ))}
      </div>

      <div className={styles.stage}>
        {building ? (
          <div className={styles.building}>
            <div>
              <div className={styles.orb} aria-hidden="true">
                <span className={styles.orbMark} />
              </div>
              <h3>Building your lesson</h3>
              <div className={styles.steps}>
                {BUILD_STEPS.map((label, i) => (
                  <div
                    key={label}
                    className={`${styles.step} ${
                      i < step ? styles.stepDone : i === step ? styles.stepNow : ""
                    }`}
                  >
                    <b aria-hidden="true">&#10003;</b>
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.pane}>
            {tab === "slides" && <DemoSlides />}
            {tab === "comp" && <DemoComprehension />}
            {tab === "ws" && <DemoWorksheet />}
          </div>
        )}
      </div>
    </div>
  );
}
