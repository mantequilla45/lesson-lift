"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { TABS } from "./tabs-shared";

// Tab strip for Usage & Billing.
//
// These are <Link>s, not useState and not router.push. Three reasons, all from
// docs/instant-navigation-guide.md:
//   - the active tab lives in the URL, so it is linkable, bookmarkable, and
//     survives a refresh or a back button (§7);
//   - <Link> auto-prefetches the segment, so the tab is usually already warm by
//     the time it's clicked (§2);
//   - they are real anchors, so middle-click and "open in new tab" work.
//
// Deliberately NOT role="tab". ARIA tabs come with a contract — arrow-key
// navigation between tabs, aria-controls pointing at a tabpanel, tabindex
// management — and claiming the role without honouring it is worse for a screen
// reader than plain links that say what they are. aria-current="page" is the
// honest description of a link to the page you're on.

// TABS lives in ./tabs-shared so the server page can import it as a real value;
// exports from a "use client" module reach the server as reference stubs, not
// arrays.

export default function Tabs({ active }: { active: string }) {
  const searchParams = useSearchParams();

  return (
    <nav
      aria-label="Usage and billing sections"
      className="inline-flex gap-1 p-1 rounded-2xl border mb-6"
      style={{ backgroundColor: "#FAF9F5", borderColor: "#DAD8D0" }}
    >
      {TABS.map(({ id, label }) => {
        // Copy the CURRENT params and change only `tab`, rather than building a
        // fresh query string. That keeps ?checkout=success / ?topup=success
        // alive across a tab click — without it, a teacher arriving from Stripe
        // loses the confirmation banner the moment they look at anything else.
        const params = new URLSearchParams(searchParams.toString());
        params.set("tab", id);

        const isActive = active === id;

        return (
          <Link
            key={id}
            href={`/account/billing?${params.toString()}`}
            aria-current={isActive ? "page" : undefined}
            className="px-4 py-2 text-sm font-semibold rounded-xl transition-colors"
            style={
              isActive
                ? { backgroundColor: "#1a1a1a", color: "#fff" }
                : { color: "#6b6055" }
            }
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
