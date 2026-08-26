"use client";

import { useSyncExternalStore } from "react";

/*
 * Reads a CSS media query from JS.
 *
 * Needed because SideNav's collapse animation is driven by inline
 * style={{ maxWidth, opacity }} rather than Tailwind classes, and a breakpoint
 * cannot override an inline style. The collapsed/expanded decision therefore
 * has to be made in JS — see `railCollapsed` in SideNav.
 *
 * useSyncExternalStore rather than useState + useEffect: a media query IS an
 * external store, so this is SSR-safe by construction (server snapshot false,
 * no hydration mismatch) with no setState in an effect. Same shape as the
 * pinned-tools store in app/lib/usePinnedTools.ts.
 */

// One MediaQueryList per query string, kept for the lifetime of the page.
// getSnapshot must be cheap and referentially stable, so the list is cached
// rather than recreated on every read.
const lists = new Map<string, MediaQueryList>();

function listFor(query: string): MediaQueryList {
  let mql = lists.get(query);
  if (!mql) {
    mql = window.matchMedia(query);
    lists.set(query, mql);
  }
  return mql;
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (callback) => {
      const mql = listFor(query);
      mql.addEventListener("change", callback);
      return () => mql.removeEventListener("change", callback);
    },
    () => listFor(query).matches,
    () => false,
  );
}
