// Shared shapes and presentation for teacher-facing notifications.
//
// The database still calls these "announcements" — the table, the RPCs
// (my_announcements, announcement_seen, announcement_dismiss,
// my_announcements_unread) and /admin/announce all keep that name. Only the
// teacher-facing noun changed. Renaming the schema would have meant a migration
// against live data for a purely cosmetic gain, so the boundary sits here: this
// module is where "announcement" becomes "notification".
//
// TONE started life copy-pasted between AnnouncementBanner and the
// announcements page. The bell popover would have been a third copy, which is
// where "one more won't hurt" stops being true.
//
// No "use client": the banner, the page and the popover are all client
// components, but a plain module can be imported by either side.

export interface MyNotification {
  id: string;
  message: string;
  type: "info" | "warning" | "maintenance";
  dismissible: boolean;
  starts_at: string;
  seen: boolean;
}

// Borrowed from the palette the rest of the app already uses, so a notification
// reads as part of the product rather than a system alert bolted on top.
export const TONE: Record<
  MyNotification["type"],
  { bg: string; fg: string; border: string }
> = {
  info: { bg: "#EAEFF7", fg: "#2C55C0", border: "#D6DEF2" },
  warning: { bg: "#FDF1DC", fg: "#8A5A12", border: "#F2E2C0" },
  maintenance: { bg: "#FAE7E0", fg: "#A33F26", border: "#F0D2C7" },
};

export const TYPE_LABEL: Record<MyNotification["type"], string> = {
  info: "Update",
  warning: "Please read",
  maintenance: "Maintenance",
};

/** Tone for a row, falling back to `info` for a type the UI doesn't know.
 *  The check constraint on the table means this shouldn't happen, but a new
 *  type shipped server-first should degrade to a readable card, not a crash. */
export function toneFor(type: MyNotification["type"]) {
  return TONE[type] ?? TONE.info;
}

export function labelFor(type: MyNotification["type"]): string {
  return TYPE_LABEL[type] ?? "Update";
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** The badge caps at 9+. The pill is `min-w-4.5`, so an unclamped count of 100
 *  rendered three digits into a circle sized for one. */
export function formatBadge(count: number): string {
  return count > 9 ? "9+" : String(count);
}
