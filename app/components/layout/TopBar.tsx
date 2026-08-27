"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, LogOut, Shield, BarChart3, UserRound, Menu } from "lucide-react";
import { createClient } from "@/app/lib/auth/client";
import ToolSearch from "@/app/components/layout/ToolSearch";
import NotificationBell from "@/app/components/layout/NotificationBell";
import Avatar from "@/app/components/ui/Avatar";
import {
  useProfileIdentity,
  setProfileIdentity,
  clearProfileIdentity,
} from "@/app/lib/useProfileIdentity";

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

  // Name and avatar come from a shared store, not from local state.
  //
  // The profile form is a SIBLING of this component, so it cannot pass a new
  // photo down, and router.refresh() does not reach here — that re-renders
  // server components, and this is a client one whose state survives. The
  // effect below is keyed on pathname, which does not change when you save on
  // the page you are already on. Before the store, the bar kept the old photo
  // until the teacher navigated somewhere else.
  const identity = useProfileIdentity();
  const displayName = identity?.name ?? "";
  const avatarUrl = identity?.avatarUrl ?? null;
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Who's signed in, what they look like, and may they see the Admin link.
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
  // Keyed on pathname so a sign-in/sign-out or an account switch is picked up.
  // The result is published to the shared store rather than held locally, so
  // this component and the profile form can never disagree about which photo is
  // current — see app/lib/useProfileIdentity.ts.
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
    // tab doesn't flash the previous teacher's avatar before their own loads.
    clearProfileIdentity();
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
        {/* Notifications. A bell reads as "news for you", so it goes where the
            notifications are; support replies badge the Help item in the
            sidebar instead, alongside the conversations themselves. */}
        <NotificationBell />

        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen((v) => !v)}
            aria-label="Account menu"
            aria-haspopup="menu"
            aria-expanded={profileOpen}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:opacity-85 transition-opacity cursor-pointer"
          >
            <Avatar url={avatarUrl} name={displayName} size={36} />
          </button>
          {profileOpen && (
            <div className="absolute right-0 top-full mt-2 w-60 bg-white border border-gray-200 rounded-2xl shadow-lg z-50 overflow-hidden">
              {userEmail && (
                <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
                  <Avatar url={avatarUrl} name={displayName} size={36} />
                  <div className="min-w-0">
                    {displayName ? (
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {displayName}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400">Signed in as</p>
                    )}
                    <p className="text-xs text-gray-400 truncate">{userEmail}</p>
                  </div>
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
                href="/profile"
                className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <UserRound className="w-4 h-4" />
                Profile
              </Link>
              {/* Straight to the section rather than through /account/billing's
                  redirect, which exists for Stripe's return URLs and old
                  bookmarks, not for links we control. */}
              <Link
                href="/profile?section=subscription"
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
