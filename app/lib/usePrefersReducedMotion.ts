"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(callback: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

/**
 * Whether the visitor has asked for reduced motion.
 *
 * `useSyncExternalStore` rather than an effect so the value is correct on the
 * first client render instead of flashing the animated state for a frame. The
 * server snapshot is `false`: the preference is not knowable server-side, and
 * the markup rendered is identical either way, so this only decides whether an
 * animation is allowed to start once hydrated.
 */
export function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
