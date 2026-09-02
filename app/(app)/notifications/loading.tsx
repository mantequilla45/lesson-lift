import styles from "./notifications.module.css";

// Only the page body: the sidebar and top bar come from app/(app)/layout.tsx
// and are not remounted between these routes. NotificationsView declares its
// own title and suppresses the banner on arrival.
export default function Loading() {
  return (
    <div className={styles.skeleton}>
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className={styles.skeletonRow} />
      ))}
    </div>
  );
}
