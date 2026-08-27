import { redirect } from "next/navigation";

// /announcements is now /notifications.
//
// Kept as a redirect rather than deleted: this was the sidebar destination, the
// banner's "See all" target and the bell's destination for the whole of launch,
// so it is in browser histories and bookmarks. It is also what the support reply
// emails and any past announcement copy point at. Deleting the route would 404
// all of those.
//
// Only the teacher-facing noun changed — the announcements table, the
// announcement_* RPCs and /admin/announce keep their names. See
// app/lib/notifications.ts.
//
// A server-component redirect() rather than a next.config.ts entry: config
// redirects are resolved before render and break the client-side transition for
// in-app links, which is the thing docs/instant-navigation-guide.md is about.
// redirect() also defaults to `replace` outside Server Actions, so the dead URL
// doesn't linger in the back-button history.
export default async function AnnouncementsRedirect() {
  redirect("/notifications");
}
