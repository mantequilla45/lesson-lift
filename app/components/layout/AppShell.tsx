"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import SideNav from "@/app/components/layout/SideNav";
import TopBar from "@/app/components/layout/TopBar";
import SupportLauncher from "@/app/components/SupportLauncher";
import AnnouncementBanner from "@/app/components/AnnouncementBanner";
import { useMediaQuery } from "@/app/lib/useMediaQuery";

/*
 * The app chrome — sidebar, top bar, support launcher, announcement banner —
 * for every signed-in teacher page.
 *
 * This used to be copy-pasted into twelve files (nine views plus three
 * loading.tsx skeletons). It is a component now because the mobile drawer
 * needs ONE owner for its open/closed state: TopBar renders the hamburger and
 * SideNav *is* the drawer, so the state has to live above both. Threading that
 * through twelve call sites, three of which are skeletons with no data access
 * at all, is what this replaces.
 *
 * The drawer lives here rather than inside SideNav for a second reason: SideNav
 * is a sibling of <main>, so it is NOT remounted on navigation. A nav link tap
 * would leave the drawer open over the newly rendered page. The pathname effect
 * below is what closes it.
 */

export interface AppShellProps {
  /** Page title, rendered by TopBar. */
  title: string;
  children: React.ReactNode;
  /**
   * Extra chrome mounted as a sibling of SideNav — in practice <UpgradeGate />,
   * which pages outside /tools must mount themselves because they do not
   * inherit the one in app/tools/layout.tsx.
   */
  slot?: React.ReactNode;
  /** Suppress the announcement banner. Default true (shown). */
  banner?: boolean;
  /**
   * "scroll" — the page scrolls (the common case).
   * "fixed"  — <main> is pinned to the viewport and the page owns its own
   *            scrolling regions. Used by /help and /assistant, whose panels
   *            are sized against the viewport.
   */
  variant?: "scroll" | "fixed";
  /** Mount the floating support widget. Default true. */
  launcher?: boolean;
  /** Replaces the default content well classes. */
  contentClassName?: string;
}

export default function AppShell({
  title,
  children,
  slot,
  banner = true,
  variant = "scroll",
  launcher = true,
  contentClassName,
}: AppShellProps) {
  const pathname = usePathname();

  // The drawer is open only for the route it was opened on. Storing the
  // pathname rather than a boolean is what closes it on navigation: SideNav is
  // a sibling of <main> and so is NOT remounted between routes, which without
  // this would leave the drawer sitting open over the newly rendered page.
  // Derived rather than reset in an effect, so there is no cascading render.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const navOpen = openedAt === pathname;
  const setNavOpen = useCallback(
    (next: boolean) => setOpenedAt(next ? pathname : null),
    [pathname],
  );

  // Focus returns to the hamburger when the drawer closes — but only if the
  // drawer was ever opened. Without this guard every page load would steal
  // focus to the menu button on mount.
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const hasOpened = useRef(false);

  const closeNav = useCallback(() => setNavOpen(false), [setNavOpen]);

  // The rail is only a drawer below `lg`; at `lg` and up it is an in-flow
  // sibling and nothing is overlaying the page. Widening past the breakpoint
  // with the drawer open therefore has to drop the drawer-only behaviour —
  // the backdrop hides itself via `lg:hidden`, but the scroll lock and the
  // Escape handler are JS and no breakpoint reaches them. Without this,
  // resizing a phone-width window to desktop left `body { overflow: hidden }`
  // stuck and the page could not be scrolled at all.
  const isMobile = useMediaQuery("(max-width: 1023px)");
  const drawerOpen = navOpen && isMobile;

  // Scroll lock while the drawer is open.
  //
  // Deliberately the plain `overflow: hidden` version, not the
  // `position: fixed; top: -scrollY` iOS trick: that one destroys and restores
  // scroll position, and ResultPanel calls window.scrollTo while a generation
  // streams. The two would fight. The drawer scrolls internally, so the only
  // cost here is iOS rubber-banding, which is cosmetic.
  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [drawerOpen]);

  // Escape closes. Mirrors the handler shape in SupportLauncher.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeNav();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen, closeNav]);

  useEffect(() => {
    if (drawerOpen) {
      hasOpened.current = true;
    } else if (hasOpened.current) {
      menuButtonRef.current?.focus();
    }
  }, [drawerOpen]);

  const fixed = variant === "fixed";

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "#F1EFE3" }}>
      {slot}

      <SideNav mobileOpen={drawerOpen} onMobileClose={closeNav} />

      {/* Backdrop. Rendered here rather than inside SideNav so the stacking
          order reads in one place: backdrop z-40, drawer z-50. */}
      {drawerOpen && (
        <div
          onClick={closeNav}
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      {launcher && <SupportLauncher />}

      {/* min-w-0 is load-bearing: a flex child refuses to shrink below its
          content's intrinsic width, which is why a wide table used to blow out
          the whole page instead of scrolling inside its own overflow-x-auto
          box. Every table fix downstream depends on this.

          h-dvh rather than h-screen for the fixed variant — 100vh on mobile
          includes the collapsing URL bar, which puts the assistant's composer
          permanently below the fold. */}
      {/* min-h-screen on the scroll variant so a short page's content well still
          fills the viewport — /tools relied on this to keep its footer area
          from riding up under the fold. */}
      <main
        className={
          fixed
            ? "grow flex flex-col min-w-0 h-dvh overflow-hidden"
            : "grow flex flex-col min-w-0 min-h-screen overflow-y-auto"
        }
      >
        <TopBar title={title} onMenuClick={() => setNavOpen(true)} menuButtonRef={menuButtonRef} />
        {banner && <AnnouncementBanner />}

        <div className={contentClassName ?? "px-4 sm:px-6 lg:px-10 pb-16 space-y-4"}>{children}</div>
      </main>
    </div>
  );
}
