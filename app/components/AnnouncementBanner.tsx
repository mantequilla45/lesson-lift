"use client";

// The teacher-facing half of /admin/announce.
//
// Renders at the top of every page that carries the app chrome. There is no
// shared teacher layout — SideNav and TopBar are imported per page — so this is
// mounted at each of those call sites individually. If a shared
// app/(app)/layout.tsx ever lands, this moves there and the call sites go away.
//
// Returns null when there is nothing live for this teacher, which is the usual
// case, so mounting it costs nothing on a quiet day.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { createClient } from "@/app/lib/auth/client";

interface MyAnnouncement {
  id: string;
  message: string;
  type: "info" | "warning" | "maintenance";
  dismissible: boolean;
  starts_at: string;
  seen: boolean;
}

// Borrowed from the palette the rest of the app already uses, so a banner reads
// as part of the product rather than a system alert bolted on top.
const TONE: Record<MyAnnouncement["type"], { bg: string; fg: string; border: string }> = {
  info: { bg: "#EAEFF7", fg: "#2C55C0", border: "#D6DEF2" },
  warning: { bg: "#FDF1DC", fg: "#8A5A12", border: "#F2E2C0" },
  maintenance: { bg: "#FAE7E0", fg: "#A33F26", border: "#F0D2C7" },
};

export default function AnnouncementBanner() {
  const pathname = usePathname();
  const [rows, setRows] = useState<MyAnnouncement[]>([]);

  // Which ids we've already reported as seen this session. The RPC is
  // idempotent, so this is only to avoid pointless round trips on re-render.
  const reported = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("my_announcements");
      // A signed-out user or a transient failure means no banner, not an error
      // state — this is decoration on someone else's page.
      if (cancelled || error) return;
      setRows((data ?? []) as MyAnnouncement[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const current = rows[0];

  // Record the view once the teacher has actually been shown one.
  useEffect(() => {
    if (!current || current.seen || reported.current.has(current.id)) return;
    reported.current.add(current.id);
    const supabase = createClient();
    void supabase.rpc("announcement_seen", { p_id: current.id });
  }, [current]);

  if (!current) return null;

  const tone = TONE[current.type] ?? TONE.info;

  const dismiss = async () => {
    // Optimistic: the row goes now, and the write is idempotent, so a failure
    // means it reappears on the next navigation rather than anything worse.
    setRows((prev) => prev.filter((r) => r.id !== current.id));
    const supabase = createClient();
    await supabase.rpc("announcement_dismiss", { p_id: current.id });
  };

  const trackClickThrough = () => {
    const supabase = createClient();
    void supabase.rpc("announcement_clicked", { p_id: current.id });
  };

  return (
    <div className="px-4 sm:px-6 lg:px-10 pt-4">
      <div
        className="rounded-2xl border px-4 py-3 flex items-start gap-3"
        style={{ backgroundColor: tone.bg, borderColor: tone.border }}
        role="status"
      >
        <p className="text-sm grow leading-snug" style={{ color: tone.fg }}>
          {current.message}
        </p>

        {rows.length > 1 && (
          <Link
            href="/announcements"
            onClick={trackClickThrough}
            className="text-xs font-semibold underline shrink-0 mt-0.5 transition-opacity hover:opacity-70"
            style={{ color: tone.fg }}
          >
            See all ({rows.length})
          </Link>
        )}

        {current.dismissible && (
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss announcement"
            className="shrink-0 rounded-lg p-0.5 transition-opacity hover:opacity-60 cursor-pointer"
            style={{ color: tone.fg }}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
