"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SECTIONS } from "./sections-shared";

// The settings menu down the left of /profile.
//
// These are <Link>s, not useState and not router.push — the same three reasons
// as app/account/billing/Tabs.tsx, all from docs/instant-navigation-guide.md:
//   - the active section lives in the URL, so it is linkable, bookmarkable, and
//     survives a refresh or a back button (§7);
//   - <Link> auto-prefetches, so the section is usually warm by the time it's
//     clicked (§2);
//   - they are real anchors, so middle-click and "open in new tab" work.
//
// Deliberately NOT role="tab", for the reason spelled out in Tabs.tsx: ARIA tabs
// come with a contract (arrow-key navigation, aria-controls, tabindex
// management) and claiming the role without honouring it is worse for a screen
// reader than plain links. aria-current="page" is the honest description.
//
// SECTIONS lives in ./sections-shared so the server page can import it as a real
// value.

export default function SettingsNav({ active }: { active: string }) {
  const searchParams = useSearchParams();

  return (
    <nav
      aria-label="Profile sections"
      /* A vertical rail at `lg`; below it, a horizontally scrollable strip above
         the panel. -mx-4 + px-4 lets the row bleed to the screen edges so the
         last item doesn't look clipped mid-scroll. */
      className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible
                 -mx-4 px-4 lg:mx-0 lg:px-0 pb-2 lg:pb-0"
    >
      {SECTIONS.map(({ id, label }) => {
        // Copy the CURRENT params and change only `section`, rather than
        // building a fresh query string — that keeps ?checkout=success /
        // ?topup=success alive across a click, so a teacher arriving back from
        // Stripe doesn't lose the confirmation banner by looking at anything
        // else. Same reasoning as the billing tab strip.
        const params = new URLSearchParams(searchParams.toString());
        params.set("section", id);
        // `tab` belongs to the Subscription section only. Carrying it onto
        // Personal info would leave a stale ?tab=history in the URL that
        // reappears the next time Subscription is opened.
        if (id !== "subscription") params.delete("tab");

        const isActive = active === id;

        return (
          <Link
            key={id}
            href={`/profile?${params.toString()}`}
            aria-current={isActive ? "page" : undefined}
            className={`px-4 py-2.5 text-sm font-semibold rounded-2xl transition-colors whitespace-nowrap shrink-0 lg:shrink${
              isActive ? "" : " hover:bg-(--j-tint)"
            }`}
            style={
              isActive
                ? { backgroundColor: "var(--j-purple)", color: "#fff" }
                : { color: "var(--j-body)" }
            }
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
