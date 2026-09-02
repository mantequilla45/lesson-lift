import styles from "./loading.module.css";

// The shell lives in app/(app)/layout.tsx and is NOT remounted between these
// routes, so this renders only the page body. Mounting a second AppShellV2
// here would draw a sidebar and top bar inside the real one.
//
// Today is an async server component because it reads editable copy, so
// navigation has a server round-trip to cover. Without this the route segment
// shows nothing at all while that resolves. Shapes mirror TodayView so the real
// content lands without a layout shift.
export default function Loading() {
  return (
    <>
      <div className={styles.hello}>
        <div className={`${styles.bar} ${styles.eyebrow}`} />
        <div className={`${styles.bar} ${styles.title}`} />
        <div className={`${styles.bar} ${styles.sub}`} />
      </div>

      <div className={styles.mo} />

      <div className={styles.metrics}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={styles.metric} />
        ))}
      </div>

      <div className={styles.quick}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={styles.card} />
        ))}
      </div>
    </>
  );
}
