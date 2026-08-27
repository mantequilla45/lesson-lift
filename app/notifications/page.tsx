import NotificationsView from "./NotificationsView";

// The list is per-teacher (my_announcements filters by their plan and what they
// have dismissed), so there is nothing here worth caching.
export const dynamic = "force-dynamic";

export default function NotificationsPage() {
  return <NotificationsView />;
}
