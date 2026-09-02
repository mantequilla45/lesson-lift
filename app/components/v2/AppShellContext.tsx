"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/*
 * Per-page chrome settings, for pages that live under a SHARED shell.
 *
 * The problem this solves: AppShellV2 used to be mounted inside each page, so
 * every navigation unmounted the sidebar and rebuilt it. The counts refetched,
 * the credit meter and level box reset, and the rail flashed empty between
 * routes. Hoisting the shell into a layout fixes that, because a layout is not
 * remounted when you navigate between the routes it wraps.
 *
 * But the props were per-page: each page passed its own title, and some pass a
 * different content well or suppress the banner. A layout cannot know those.
 * So the page declares them instead, through this context, and the shell reads
 * them. Nothing about the shell unmounts when the values change.
 *
 * `title` is the only one that changes per route in practice; the rest are here
 * because they are equally per-page and splitting them across two mechanisms
 * would be worse than carrying four extra fields.
 */

export interface AppShellSettings {
  title: string;
  /** Suppress the announcement banner. Default true (shown). */
  banner?: boolean;
  /** Mount the floating support widget. Default true. */
  launcher?: boolean;
  /** Replaces the default content well, for pages that own their own padding. */
  contentClassName?: string;
  /**
   * "scroll" — the page scrolls (the common case).
   * "fixed"  — <main> is pinned to the viewport and the page owns its own
   *            scrolling regions. Ask Mo and Help, whose panes are sized
   *            against the viewport.
   */
  variant?: "scroll" | "fixed";
}

interface AppShellContextValue {
  settings: AppShellSettings;
  setSettings: (next: AppShellSettings) => void;
}

const AppShellContext = createContext<AppShellContextValue | null>(null);

export function AppShellProvider({
  defaultTitle,
  children,
}: {
  defaultTitle: string;
  children: React.ReactNode;
}) {
  const [settings, setSettings] = useState<AppShellSettings>({ title: defaultTitle });
  const value = useMemo(() => ({ settings, setSettings }), [settings]);
  return <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>;
}

/** Read the current settings. For the shell itself, not for pages. */
export function useAppShellSettings(): AppShellSettings | null {
  return useContext(AppShellContext)?.settings ?? null;
}

/**
 * Declare this page's chrome. Call it at the top of a page under the shared
 * shell.
 *
 * The fields are spread into the dependency list rather than passed as an
 * object, so a page can call this with an inline literal without re-running the
 * effect on every render.
 */
export function useAppShell(settings: AppShellSettings): void {
  const ctx = useContext(AppShellContext);
  const setSettings = ctx?.setSettings;
  const { title, banner, launcher, contentClassName, variant } = settings;

  // Stable setter, so the effect below depends only on the values.
  const apply = useCallback(() => {
    setSettings?.({ title, banner, launcher, contentClassName, variant });
  }, [setSettings, title, banner, launcher, contentClassName, variant]);

  useEffect(() => {
    apply();
  }, [apply]);
}
