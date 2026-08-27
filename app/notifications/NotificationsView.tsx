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
import { X } from "lucide-react";
import AppShell from "@/app/components/layout/AppShell";
import { createClient } from "@/app/lib/auth/client";
import {
  type MyNotification,
  toneFor,
  labelFor,
  formatDate,
} from "@/app/lib/notifications";

export default function NotificationsView() {
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
    <AppShell
      title="Notifications"
      banner={false}
      launcher={false}
      contentClassName="px-4 sm:px-6 lg:px-10 pb-16"
    >
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="h-20 rounded-2xl"
              style={{ backgroundColor: "#EEECE4" }}
            />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div
          className="rounded-3xl border py-12 sm:py-16 text-center"
          style={{ backgroundColor: "#FAF9F5", borderColor: "#DAD8D0" }}
        >
          <p className="text-base font-medium" style={{ color: "#1a1a1a" }}>
            Nothing to report
          </p>
          <p className="text-sm mt-1" style={{ color: "#8a8078" }}>
            Notifications from the Jooma team show up here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const tone = toneFor(r.type);
            return (
              <div
                key={r.id}
                className="rounded-2xl border px-5 py-4 flex items-start gap-3"
                style={{ backgroundColor: tone.bg, borderColor: tone.border }}
              >
                <div className="grow min-w-0">
                  <div
                    className="text-[11px] font-bold uppercase tracking-wide mb-1"
                    style={{ color: tone.fg, opacity: 0.75 }}
                  >
                    {labelFor(r.type)} · {formatDate(r.starts_at)}
                  </div>
                  <p className="text-sm leading-snug" style={{ color: tone.fg }}>
                    {r.message}
                  </p>
                </div>
                {r.dismissible && (
                  <button
                    type="button"
                    onClick={() => dismiss(r.id)}
                    aria-label="Dismiss notification"
                    className="shrink-0 rounded-lg p-0.5 transition-opacity hover:opacity-60 cursor-pointer"
                    style={{ color: tone.fg }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
