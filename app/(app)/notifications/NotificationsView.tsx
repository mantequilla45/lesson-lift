"use client";

// The full list behind the banner and the bell. A teacher who dismissed
// something, or who has several live at once, needs somewhere to read them all —
// the banner only ever shows one, and the bell popover shows the most recent
// few.
//
// Visiting this page marks everything unseen as seen, which is what clears the
// sidebar and bell badges.
//
// The database still calls these announcements; see app/lib/notifications.ts for
// why the rename stopped at the UI.

import { useEffect, useState } from "react";
import { X, Bell } from "@phosphor-icons/react/dist/ssr";
import { useAppShell } from "@/app/components/v2/AppShellContext";
import { createClient } from "@/app/lib/auth/client";
import {
  type MyNotification,
  toneFor,
  labelFor,
  formatDate,
} from "@/app/lib/notifications";
import app from "@/app/components/v2/app.module.css";
import styles from "./notifications.module.css";

export default function NotificationsView() {
  useAppShell({ title: "Updates", banner: false, launcher: false });

  const [rows, setRows] = useState<MyNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("my_announcements");
      if (cancelled) return;

      const list = error ? [] : ((data ?? []) as MyNotification[]);
      setRows(list);
      setLoading(false);

      // Reading the page counts as having seen all of them — this is what takes
      // the badge off the sidebar and the bell.
      await Promise.all(
        list
          .filter((r) => !r.seen)
          .map((r) => supabase.rpc("announcement_seen", { p_id: r.id })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = async (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    const supabase = createClient();
    await supabase.rpc("announcement_dismiss", { p_id: id });
  };

  return (
    // The banner is suppressed because this page IS the list it links to, and
    // the support launcher because a notification is not a support thread.
    <>
      {loading ? (
        <div className={styles.skeleton}>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className={styles.skeletonRow} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className={app.panel}>
          <div className={app.empty}>
            <span className={app.emptyIcon}>
              <Bell weight="fill" />
            </span>
            <p className={app.emptyTitle}>Nothing to report</p>
            <p className={app.emptyBody}>
              Updates from the Jooma team show up here.
            </p>
          </div>
        </div>
      ) : (
        <div className={styles.list}>
          {rows.map((r) => {
            const tone = toneFor(r.type);
            return (
              // Tones are shared with the banner and the bell popover — three
              // renderings of the same rows — so they stay inline from
              // app/lib/notifications.ts rather than being restated here.
              <div
                key={r.id}
                className={styles.item}
                style={{ backgroundColor: tone.bg, borderColor: tone.border }}
              >
                <div className={styles.itemBody}>
                  <div className={styles.itemMeta} style={{ color: tone.fg }}>
                    {labelFor(r.type)} · {formatDate(r.starts_at)}
                  </div>
                  <p className={styles.itemText} style={{ color: tone.fg }}>
                    {r.message}
                  </p>
                </div>
                {r.dismissible && (
                  <button
                    type="button"
                    onClick={() => dismiss(r.id)}
                    aria-label="Dismiss"
                    className={styles.dismiss}
                    style={{ color: tone.fg }}
                  >
                    <X className={styles.dismissIcon} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
