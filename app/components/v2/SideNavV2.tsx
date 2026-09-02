"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  SquaresFour,
  Folder,
  CalendarBlank,
  UsersThree,
  ChatTeardropDots,
  Bell,
  Question,
  Medal,
  X,
} from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/app/lib/auth/client";
import { TOOLS, V2_TOOLS, toolSolid } from "@/app/lib/tools";
import { useCreditMeter } from "@/app/lib/useCreditMeter";
import { useBadgeProgress } from "@/app/lib/useBadgeProgress";
import { usePinnedTools } from "@/app/lib/usePinnedTools";
import Wordmark from "@/app/components/v2/Wordmark";
import TopUpModal from "@/app/components/v2/TopUpModal";
import ToolSearch from "@/app/components/layout/ToolSearch";
import { ToolTile } from "@/app/components/v2/Squircle";
import styles from "./SideNavV2.module.css";

/*
 * The 250px rail.
 *
 * Icons are Phosphor at REGULAR weight: this is interface chrome, and fill
 * weight is reserved for glyphs sitting inside a coloured tile.
 *
 * Nav counts are live values, not decoration. "Make" counts the tools that
 * actually exist; "Library" counts the teacher's own saved resources.
 */

interface NavItem {
  label: string;
  href: string;
  Icon: React.ComponentType<{ className?: string; weight?: "regular" | "fill" }>;
  /** Which count to show, if any. */
  count?: "tools" | "resources" | "colleagues";
  /**
   * Features designed but not built. Rendered as a disabled row with a
   * "Soon" pill rather than a link, so the shape of the product is visible
   * without promising something that does not work yet.
   */
  soon?: boolean;
}

const NAV: NavItem[] = [
  { label: "Today", href: "/dashboard", Icon: House },
  { label: "Make", href: "/tools", Icon: SquaresFour, count: "tools" },
  { label: "Library", href: "/folders", Icon: Folder, count: "resources" },
  { label: "Timetable", href: "/timetable", Icon: CalendarBlank },
  { label: "Colleagues", href: "/colleagues", Icon: UsersThree, count: "colleagues" },
  // Named for what it is, not what powers it. The language rules in
  // scripts/check-language.mjs fail the build on "AI" in teacher-facing copy,
  // which is what the old "AI assistant" label was.
  { label: "Ask Mo", href: "/assistant", Icon: ChatTeardropDots },
];

interface SideNavV2Props {
  /** Below 900px the rail is an off-canvas drawer; this is its open state. */
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function SideNavV2({ mobileOpen = false, onMobileClose }: SideNavV2Props) {
  const pathname = usePathname();
  const credits = useCreditMeter();
  const badges = useBadgeProgress();
  const [topUpOpen, setTopUpOpen] = useState(false);

  // Pinned tools — a shared store, kept in sync with the Library page live.
  const pinnedHrefs = usePinnedTools();
  const pinnedTools = pinnedHrefs.flatMap((href) => {
    const tool = V2_TOOLS.find((t) => t.href === href);
    return tool ? [tool] : [];
  });

  // The teacher's saved resource count, and the two unread badges. Re-fetched
  // on navigation so the counts settle after a generation is saved or a
  // notification is read, without needing a full reload.
  const [resourceCount, setResourceCount] = useState<number | null>(null);
  const [colleagueCount, setColleagueCount] = useState<number | null>(null);
  const [supportUnread, setSupportUnread] = useState(0);
  const [announceUnread, setAnnounceUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const [runs, colleagues, support, announce] = await Promise.all([
        // head + exact count: no rows come back, just the number. RLS scopes it
        // to the signed-in teacher.
        supabase.from("tool_runs").select("id", { count: "exact", head: true }),
        // colleague_edges stores both directions, so this is already the
        // connection count without a de-duplicating OR. Counted here rather
        // than via listColleagues(), which also fetches every profile.
        supabase.from("colleague_edges").select("other_id", { count: "exact", head: true }),
        supabase.rpc("my_support_unread"),
        supabase.rpc("my_announcements_unread"),
      ]);
      if (cancelled) return;
      setResourceCount(runs.count ?? null);
      // null on error (the table is absent on an environment without the
      // migration), which hides the count rather than showing a false zero.
      setColleagueCount(colleagues.error ? null : colleagues.count ?? null);
      setSupportUnread(Number(support.data ?? 0));
      setAnnounceUnread(Number(announce.data ?? 0));
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  // Focus moves into the drawer when it opens, so a keyboard or screen-reader
  // user is not left behind on the page underneath. AppShellV2 handles
  // returning focus to the hamburger on close.
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (mobileOpen) closeButtonRef.current?.focus();
  }, [mobileOpen]);

  const countFor = (item: NavItem): number | null => {
    if (item.count === "tools") return TOOLS.length;
    if (item.count === "resources") return resourceCount;
    // Hidden at zero: "Colleagues 0" reads as a failure state, and the empty
    // page already explains how to connect to someone.
    if (item.count === "colleagues") return colleagueCount || null;
    return null;
  };

  return (
    <>
      <aside
        id="app-sidenav-v2"
        className={`${styles.side} ${mobileOpen ? styles.sideOpen : ""}`}
        aria-hidden={undefined}
      >
        <div className={styles.head}>
          <Link href="/dashboard" className={styles.logo} aria-label="Jooma, go to Today">
            <Wordmark height={22} />
          </Link>
          {/* Drawer-only. The rail has nothing to close. */}
          <button
            type="button"
            ref={closeButtonRef}
            onClick={onMobileClose}
            aria-label="Close navigation"
            className={styles.close}
          >
            <X className={styles.closeIcon} />
          </button>
        </div>

        {/* Tool search. Lives in the drawer on mobile because the top bar has
            no room for it there: its results panel alone is wider than a phone. */}
        <div className={styles.drawerSearch}>
          <ToolSearch variant="drawer" onNavigate={onMobileClose} />
        </div>

        <nav className={styles.nav} aria-label="Main">
          {NAV.map((item) => {
            const count = countFor(item);

            if (item.soon) {
              return (
                <span
                  key={item.label}
                  className={`${styles.navitem} ${styles.navitemSoon}`}
                  aria-disabled="true"
                >
                  <item.Icon className={styles.navicon} />
                  {item.label}
                  <span className={styles.soon}>Soon</span>
                </span>
              );
            }

            // startsWith so a tool page keeps "Make" lit. Library has no child
            // routes any more (a folder is ?folder= on /folders), but the
            // prefix match costs nothing and is right if one is ever added.
            // Exact match on /dashboard, which is a prefix of nothing but would
            // otherwise stay lit on every route if it were.
            const active =
              item.href === "/dashboard"
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.label}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`${styles.navitem} ${active ? styles.navitemOn : ""}`}
              >
                <item.Icon className={styles.navicon} weight={active ? "fill" : "regular"} />
                {item.label}
                {count !== null && <span className={styles.count}>{count}</span>}
              </Link>
            );
          })}
        </nav>

        {/* The level box, directly under the nav rather than down with credits.
            Shown from level 1 with an empty track, as in the mockup: "9 more
            badges to reach Level 2" is a goal rather than a judgement, and
            hiding it until something is earned meant most teachers would
            never discover the collection exists. Only the migration not being
            applied hides it. */}
        {badges.available && !badges.loading && (
          <Link href="/profile?section=badges" className={styles.levelBox}>
            <div className={styles.meterTop}>
              <span className={styles.meterName}>
                <Medal weight="fill" className={styles.levelIcon} />
                Level {badges.level}
              </span>
              <span className={styles.meterVal}>
                {/* "None yet" rather than "0 of 100": the count is the one
                    place a zero would read as a verdict on the teacher. */}
                {badges.earnedCount === 0
                  ? "None yet"
                  : `${badges.earnedCount} of ${badges.total}`}
              </span>
            </div>
            <div className={styles.track}>
              <i
                className={styles.trackFill}
                style={{ width: `${Math.round(badges.levelFraction * 100)}%` }}
              />
            </div>
            <p className={styles.meterNote}>
              {badges.toNextLevel === 0
                ? "The full set. Nothing left to climb."
                : `${badges.toNextLevel} more ${
                    badges.toNextLevel === 1 ? "badge" : "badges"
                  } to reach Level ${badges.level + 1}`}
            </p>
          </Link>
        )}

        <div className={styles.foot}>
          {/* Pinned from the Library page. */}
          {pinnedTools.length > 0 && (
            <div className={styles.pinned}>
              <span className={styles.pinnedHead}>Pinned</span>
              {pinnedTools.map((tool) => (
                <Link key={tool.href} href={tool.href} className={styles.pinnedItem}>
                  <ToolTile icon={tool.icon} solid={toolSolid(tool)} size="xs" />
                  <span className={styles.pinnedName}>{tool.name}</span>
                </Link>
              ))}
            </div>
          )}


          {/* Credits live HERE and in the account page, nowhere else. No per
              tool costs on cards, no chips on list rows. */}
          {credits.metered && (
            <div className={styles.meter}>
              <div className={styles.meterTop}>
                <span className={styles.meterName}>Credits</span>
                <span className={styles.meterVal}>
                  {credits.loading
                    ? "—"
                    : `${credits.remaining.toLocaleString("en-GB")} left`}
                </span>
              </div>
              <div className={styles.track}>
                <i
                  className={styles.trackFill}
                  style={{ width: `${Math.round(credits.fraction * 100)}%` }}
                />
              </div>
              <p className={styles.meterNote}>
                Refills to {credits.allowance.toLocaleString("en-GB")} on{" "}
                {credits.refillsOn.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                })}
              </p>
              <button
                type="button"
                className={styles.topup}
                onClick={() => setTopUpOpen(true)}
              >
                Top up credits
              </button>
            </div>
          )}

          <div className={styles.sideFoot}>
            <Link href="/notifications" className={styles.footLink}>
              <Bell className={styles.footIcon} />
              Updates
              {announceUnread > 0 && <span className={styles.badge}>{announceUnread}</span>}
            </Link>
            <Link href="/help" className={styles.footLink}>
              <Question className={styles.footIcon} />
              Help
              {supportUnread > 0 && <span className={styles.badge}>{supportUnread}</span>}
            </Link>
          </div>
        </div>
      </aside>

      <TopUpModal open={topUpOpen} onClose={() => setTopUpOpen(false)} />
    </>
  );
}
