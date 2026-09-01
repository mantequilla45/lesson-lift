"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { List, SignOut, ShieldCheck, ChartBar, UserCircle } from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/app/lib/auth/client";
import ToolSearch from "@/app/components/layout/ToolSearch";
import NotificationBell from "@/app/components/layout/NotificationBell";
import Avatar from "@/app/components/ui/Avatar";
import {
  useProfileIdentity,
  setProfileIdentity,
  clearProfileIdentity,
} from "@/app/lib/useProfileIdentity";
import styles from "./TopBarV2.module.css";

interface TopBarV2Props {
  title: string;
  /** Opens the mobile nav drawer. Supplied by AppShellV2. */
  onMenuClick?: () => void;
  /** So AppShellV2 can return focus here when the drawer closes. */
  menuButtonRef?: React.Ref<HTMLButtonElement>;
}

export default function TopBarV2({ title, onMenuClick, menuButtonRef }: TopBarV2Props) {
  const router = useRouter();
  const pathname = usePathname();

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Name and avatar come from a shared store, not local state. The profile form
  // is a SIBLING of this component, so it cannot pass a new photo down, and
  // router.refresh() does not reach here — that re-renders server components,
  // and this is a client one whose state survives. The effect below is keyed on
  // pathname, which does not change when you save on the page you are already
  // on. Before the store, the bar kept the old photo until you navigated away.
  const identity = useProfileIdentity();
  const displayName = identity?.name ?? "";
  const avatarUrl = identity?.avatarUrl ?? null;

  // Who is signed in, what they look like, and may they see the Admin link.
  //
  // THIS GATE IS UX ONLY. requireAdmin() and the is_admin() re-check inside
  // every admin_* RPC are the real boundary. Forging this flag in devtools
  // reveals a menu item that leads straight to a redirect.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const [{ data: userData }, { data: admin }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.rpc("is_admin"),
      ]);
      if (cancelled) return;
      setUserEmail(userData.user?.email ?? null);
      // Starts false and stays false unless the DB says otherwise, so the item
      // is absent on first paint rather than flashing in and out.
      setIsAdmin(admin === true);

      const uid = userData.user?.id;
      if (!uid) {
        clearProfileIdentity();
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, surname, avatar_url")
        .eq("id", uid)
        .maybeSingle();
      if (cancelled) return;
      setProfileIdentity({
        name: [profile?.first_name, profile?.surname].filter(Boolean).join(" "),
        avatarUrl: profile?.avatar_url ?? null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    // Drop the cached name and photo, so signing in as someone else on the same
    // tab does not flash the previous teacher's avatar before their own loads.
    clearProfileIdentity();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className={styles.top}>
      {/* Opens the nav drawer. Only exists below 900px, where the rail is
          off-canvas. */}
      <button
        type="button"
        ref={menuButtonRef}
        onClick={onMenuClick}
        aria-label="Open navigation"
        aria-controls="app-sidenav-v2"
        className={styles.menu}
      >
        <List className={styles.menuIcon} />
      </button>

      {/* min-width: 0 and an ellipsis, not a non-shrinking title: a rigid title
          next to this many controls is what pushed the row off a phone. */}
      <h2 className={styles.title}>{title}</h2>

      <div className={styles.right}>
        {/* Search. Hidden below 900px, where it lives in the nav drawer. */}
        <div className={styles.search}>
          <ToolSearch variant="bar" />
        </div>

        {/* A bell reads as "news for you", so it goes where the notifications
            are. Support replies badge the Help link in the sidebar instead,
            alongside the conversations themselves. */}
        <NotificationBell />

        <div className={styles.profile} ref={profileRef}>
          <button
            type="button"
            onClick={() => setProfileOpen((v) => !v)}
            aria-label="Account menu"
            aria-haspopup="menu"
            aria-expanded={profileOpen}
            className={styles.avatarBtn}
          >
            <Avatar url={avatarUrl} name={displayName} size={37} />
          </button>

          {profileOpen && (
            <div className={styles.menuPanel} role="menu">
              {userEmail && (
                <div className={styles.who}>
                  <Avatar url={avatarUrl} name={displayName} size={36} />
                  <div className={styles.whoText}>
                    {displayName ? (
                      <p className={styles.whoName}>{displayName}</p>
                    ) : (
                      <p className={styles.whoLabel}>Signed in as</p>
                    )}
                    <p className={styles.whoEmail}>{userEmail}</p>
                  </div>
                </div>
              )}
              {isAdmin && (
                <Link href="/admin" className={styles.menuItem} role="menuitem">
                  <ShieldCheck className={styles.menuIconSm} />
                  Admin
                </Link>
              )}
              <Link href="/profile" className={styles.menuItem} role="menuitem">
                <UserCircle className={styles.menuIconSm} />
                Profile
              </Link>
              {/* Straight to the section rather than through /account/billing's
                  redirect, which exists for Stripe's return URLs and old
                  bookmarks, not for links we control. */}
              <Link
                href="/profile?section=subscription"
                className={styles.menuItem}
                role="menuitem"
              >
                <ChartBar className={styles.menuIconSm} />
                Usage and billing
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className={styles.menuItem}
                role="menuitem"
              >
                <SignOut className={styles.menuIconSm} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
