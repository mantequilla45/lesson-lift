// The tab list, in a module with NO "use client" so both sides can import it.
//
// This lived in Tabs.tsx and broke at runtime: values exported from a client
// module are not real values to a server component. React hands the server a
// client *reference* stub for each export, so `TABS.some(...)` threw
// "TABS.some is not a function" — only the component itself is usable across
// that boundary, never its sibling exports.
//
// Same reason app/lib/fx-shared.ts exists: shared shapes go in a neutral module,
// and the "use client" file imports from it like everyone else.

export const TABS = [
  { id: "overview", label: "Overview" },
  { id: "usage", label: "Usage" },
  { id: "history", label: "History" },
] as const;

export type Tab = (typeof TABS)[number]["id"];

/**
 * Unknown ?tab= values fall back to Overview rather than 404ing. The tab is a
 * view preference, not a resource identity — a stale bookmark or a hand-edited
 * URL should show the page, not an error.
 */
export function asTab(v: string | undefined): Tab {
  return TABS.some((t) => t.id === v) ? (v as Tab) : "overview";
}
