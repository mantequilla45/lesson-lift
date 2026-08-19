import { redirect } from "next/navigation";

// /account/usage was merged into /account/billing as its "Usage" tab.
//
// Kept as a redirect rather than deleted: this was the destination of the landing
// nav's "Usage" item for the whole of launch, so it is in browser histories and
// bookmarks. Deleting the route would 404 those.
//
// A server-component redirect() rather than a next.config.ts entry: config
// redirects are resolved before render and break the client-side transition for
// in-app links, which is the thing docs/instant-navigation-guide.md is about.
// redirect() also defaults to `replace` outside Server Actions, so the dead URL
// doesn't linger in the back-button history — press Back and you return to
// wherever you actually came from.
export default async function UsageRedirect() {
  redirect("/account/billing?tab=usage");
}
