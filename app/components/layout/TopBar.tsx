"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Bell, UserCircle, LogOut, Shield, BarChart3, Menu } from "lucide-react";
import { createClient } from "@/app/lib/auth/client";
import ToolSearch from "@/app/components/layout/ToolSearch";

interface TopBarProps {
  title: string;
  /** @deprecated — search is now always visible and self-contained */
  showSearch?: boolean;
  searchValue?: string;
  /** @deprecated — no callers; search navigates on its own */
  onSearchChange?: (v: string) => void;
  /** Opens the mobile nav drawer. Supplied by AppShell. */
  onMenuClick?: () => void;
  /** So AppShell can return focus here when the drawer closes. */
  menuButtonRef?: React.Ref<HTMLButtonElement>;
}

export default function TopBar({ title, onMenuClick, menuButtonRef }: TopBarProps) {
  const router = useRouter();

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [announceUnread, setAnnounceUnread] = useState(0);
  const profileRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Who's signed in, and may they see the Admin link.
  //
  // is_admin() is asked of the database directly rather than passed in as a
  // prop. TopBar is mounted in eleven places, several of them loading.tsx
  // skeletons that exist only to paint a grey box and have no data access at
  // all — threading a permissions prop through those would put a billing
  // concern somewhere it has no business being. The RPC is a security-definer
  // SQL function already granted to `authenticated`, so this is one round trip
  // on a component that already makes one for the unread count.
  //
  // THIS GATE IS UX ONLY. requireAdmin() and the is_admin() re-check inside
  // every admin_* RPC are the real boundary — see the header comments in
  // app/lib/auth/admin.ts and admin-route.ts. Forging this flag in devtools
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
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Unread announcements. Keyed on pathname so it re-checks on navigation and
  // clears once the teacher has been shown them.
  //
  // Support replies deliberately don't feed this any more: the bell used to
  // count them and route to /help, which is not what a bell looks like it does.
  // Support keeps its own badge on the Help item in the sidebar, next to the
  // conversations it refers to.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const { data } = await supabase.rpc("my_announcements_unread");
      if (!cancelled) setAnnounceUnread(Number(data ?? 0));
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
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="flex items-center gap-3 px-4 sm:px-6 lg:px-10 py-4 lg:py-5 shrink-0">
      {/* Opens the nav drawer. Only exists below `lg`, where SideNav is
          off-canvas. */}
      <button
        type="button"
        ref={menuButtonRef}
        onClick={onMenuClick}
        aria-label="Open navigation"
        aria-controls="app-sidenav"
        className="lg:hidden w-9 h-9 shrink-0 flex items-center justify-center rounded-2xl border border-line bg-white hover:border-gray-400 transition-colors cursor-pointer"
      >
        <Menu className="w-5 h-5 text-muted" />
      </button>

      {/* min-w-0 + truncate, not shrink-0: a non-shrinking title next to ~450px
          of controls is what pushed this row off the side of a phone. */}
      <h2 className="text-lg sm:text-xl lg:text-2xl font-bold min-w-0 truncate">{title}</h2>

      <div className="flex items-center gap-2 lg:gap-3 ml-auto shrink-0">

        {/* Search. Hidden below `lg`, where it lives in the nav drawer instead. */}
        <div className="hidden lg:block">
          <ToolSearch variant="bar" />
        </div>

        {/* Disabled and decorative, so it is the first thing to go when space
            is short. */}
        <div className="relative group/storage hidden lg:block">
          <button disabled className="flex items-center gap-2 px-4 py-2 border border-line rounded-2xl text-sm font-semibold text-muted/50 cursor-not-allowed opacity-50">
            Connect Storage
            <ChevronDown className="w-4 h-4" />
          </button>
          <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-800 px-2 py-1 text-xs text-white opacity-0 group-hover/storage:opacity-100 transition-opacity">
            Coming soon
          </span>
        </div>
        {/* Announcements. A bell reads as "news for you", so it goes where the
            announcements are; support replies badge the Help item in the
            sidebar instead, alongside the conversations themselves. */}
        <div className="relative group/bell">
          <button
            onClick={() => router.push("/announcements")}
            aria-label={
              announceUnread > 0
                ? `${announceUnread} new ${announceUnread === 1 ? "announcement" : "announcements"}`
                : "Announcements"
            }
            className="relative w-9 h-9 flex items-center justify-center rounded-2xl border border-line bg-white hover:border-gray-400 transition-colors cursor-pointer"
          >
            <Bell className="w-4 h-4 text-muted" />
            {announceUnread > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-4.5 h-4.5 px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
                style={{ backgroundColor: "#B3261E" }}
              >
                {announceUnread}
              </span>
            )}
          </button>
          {announceUnread === 0 && (
            <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-800 px-2 py-1 text-xs text-white opacity-0 group-hover/bell:opacity-100 transition-opacity">
              Announcements
            </span>
          )}
        </div>
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen((v) => !v)}
            aria-label="Account menu"
            aria-haspopup="menu"
            aria-expanded={profileOpen}
            className="w-9 h-9 flex items-center justify-center rounded-2xl border border-line bg-white hover:border-gray-400 transition-colors cursor-pointer"
          >
            <UserCircle className="w-5 h-5 text-muted" />
          </button>
          {profileOpen && (
            <div className="absolute right-0 top-full mt-2 w-60 bg-white border border-gray-200 rounded-2xl shadow-lg z-50 overflow-hidden">
              {userEmail && (
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-xs text-gray-400">Signed in as</p>
                  <p className="text-sm font-medium text-gray-900 truncate">{userEmail}</p>
                </div>
              )}
              {/* Same items, same order, same classes as the landing page's
                  NavAuth dropdown, so the two are learnable as one menu rather
                  than two that happen to overlap. No "Go to dashboard" here:
                  this bar IS the app chrome, so it would link to where you
                  already are. */}
              {isAdmin && (
                <Link
                  href="/admin"
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Shield className="w-4 h-4" />
                  Admin
                </Link>
              )}
              <Link
                href="/account/billing"
                className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <BarChart3 className="w-4 h-4" />
                Usage &amp; Billing
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
