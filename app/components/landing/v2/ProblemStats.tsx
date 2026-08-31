import Reveal from "./Reveal";
import shared from "./landing.module.css";
import styles from "./ProblemStats.module.css";

/**
 * The case for the product, in three published figures.
 *
 * Every number here is real and sourced, and the source line stays with it.
 * A workload claim without a citation reads as marketing; with one it reads as
 * the thing the teacher already knows to be true.
 *
 * Burnt orange is the accent for exactly this: the cost of not acting. It is
 * not a warning colour, and it appears once per section at most.
 */
const STATS = [
  {
    figure: "50.1",
    title: "Hours a week",
    body: "The average teacher's working week. Work outside teaching hours is the norm, not the exception.",
    source: "DfE Working Lives of Teachers, 2025",
  },
  {
    figure: "20.1",
    title: "Hours on prep",
    body: "Planning, marking and admin take more time than any other task that is not teaching.",
    source: "UCL Institute of Education, 2019",
  },
  {
    figure: "92%",
    title: "Cite workload",
    body: "Workload remains the leading reason teachers give for leaving the profession.",
    source: "DfE, 2022",
  },
];

export default function ProblemStats() {
  return (
    <section className={shared.sec}>
      <div className={shared.shell}>
        <Reveal className={`${shared.secHead} ${shared.secHeadCentre}`}>
          <span className={shared.eyebrow}>What Jooma is</span>
          <h2>Thirty five tools that do the jobs you take home.</h2>
          <p className={shared.lede}>
            Not a chatbot you have to coax. Each tool asks a few questions, then hands you
            something finished, editable and matched to your class.
          </p>
        </Reveal>

        <Reveal className={styles.stats}>
          {STATS.map((stat) => (
            <div key={stat.title} className={styles.stat}>
              <p className={styles.figure}>{stat.figure}</p>
              <h3>{stat.title}</h3>
              <p className={styles.body}>{stat.body}</p>
              <p className={styles.source}>{stat.source}</p>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
