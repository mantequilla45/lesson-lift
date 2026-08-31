import { DEMO_WORKSHEET } from "@/app/lib/landing/demo-content";
import styles from "./DemoWorksheet.module.css";

/**
 * The Worksheets output: the three attainment bands side by side.
 *
 * Showing them together, rather than one at a time, is the whole argument.
 * The claim is not "a worksheet", it is "the three you would otherwise have
 * built separately".
 */
export default function DemoWorksheet() {
  return (
    <div className={styles.ws}>
      {DEMO_WORKSHEET.map((column) => (
        <div key={column.band} className={styles.column}>
          <span className={`${styles.band} ${styles[column.tone]}`}>{column.band}</span>
          <h4>{column.title}</h4>
          {column.questions.map((question, i) => (
            <div key={question} className={styles.question}>
              {i + 1}. {question}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
