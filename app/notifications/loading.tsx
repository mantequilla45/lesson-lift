import AppShellV2 from "@/app/components/v2/AppShellV2";
import styles from "./notifications.module.css";

export default function Loading() {
  return (
    <AppShellV2 title="Updates" banner={false} launcher={false}>
      <div className={styles.skeleton}>
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className={styles.skeletonRow} />
        ))}
      </div>
    </AppShellV2>
  );
}
