"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Pin } from "lucide-react";
import { useEffect, useState } from "react";
import { TOOLS } from "@/app/lib/tools";
import ToolIcon from "@/app/components/ToolIcon";
import { createClient } from "@/app/lib/auth/client";
import { usePinnedTools } from "@/app/lib/usePinnedTools";

/*
 * Nav icons are inline SVG rather than <img>, because they are two-tone: the
 * silhouette inherits `currentColor` (so it flips to white on the active dark
 * pill for free) while the `#FFCC33` accent stays put. An <img> cannot inherit
 * currentColor, which is why this used to rely on a `brightness(0)` filter —
 * that crushed every colour to black and is what made the rail look flat.
 */
type NavIconProps = { className?: string };

const DashboardIcon = ({ className }: NavIconProps) => (
  <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
    <rect x="2" y="2" width="7" height="7" rx="2.2" fill="currentColor" />
    <rect x="11" y="2" width="7" height="7" rx="2.2" fill="currentColor" fillOpacity="0.45" />
    <rect x="2" y="11" width="7" height="7" rx="2.2" fill="currentColor" fillOpacity="0.45" />
    <rect x="11" y="11" width="7" height="7" rx="2.2" fill="#FFCC33" />
  </svg>
);

const ToolsIcon = ({ className }: NavIconProps) => (
  <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
    <path
      d="M8.1 2.6a1 1 0 0 1 1.05-.6 4.6 4.6 0 0 1 3.4 6.9l4.5 4.5a2.1 2.1 0 0 1-2.95 2.95l-4.5-4.5a4.6 4.6 0 0 1-6.9-3.4 1 1 0 0 1 .6-1.05 1 1 0 0 1 1.1.24l1.9 1.9 1.6-1.6-1.9-1.9a1 1 0 0 1-.24-1.1z"
      fill="currentColor"
    />
    <circle cx="15.1" cy="15.1" r="1.35" fill="#FFCC33" />
  </svg>
);

const FoldersIcon = ({ className }: NavIconProps) => (
  <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
    <path
      d="M2 5.6a2.1 2.1 0 0 1 2.1-2.1h3.1c.5 0 .98.2 1.34.55l1.2 1.2h6.15A2.1 2.1 0 0 1 18 7.35v1H2z"
      fill="currentColor"
      fillOpacity="0.45"
    />
    <path d="M2 8.35h16v6.05A2.1 2.1 0 0 1 15.9 16.5H4.1A2.1 2.1 0 0 1 2 14.4z" fill="currentColor" />
    <rect x="8.4" y="10.6" width="3.2" height="3.2" rx="1.1" fill="#FFCC33" />
  </svg>
);

const AssistantIcon = ({ className }: NavIconProps) => (
  <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
    <path
      d="M9.4 3.1a7.5 7.5 0 1 1-6.6 11.1l-.66 2.85a.8.8 0 0 0 .96.96l2.85-.66A7.5 7.5 0 0 1 9.4 3.1z"
      fill="currentColor"
    />
    <path
      d="M16.15 1.9l.83 2.12 2.12.83-2.12.83-.83 2.12-.83-2.12-2.12-.83 2.12-.83z"
      fill="#FFCC33"
    />
  </svg>
);

const AnnouncementsIcon = ({ className }: NavIconProps) => (
  <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
    <path d="M4.6 7.4h2.2l7-3.9a.9.9 0 0 1 1.35.79v11.42a.9.9 0 0 1-1.35.79l-7-3.9H4.6A2.1 2.1 0 0 1 2.5 10.5v-1A2.1 2.1 0 0 1 4.6 7.4z" fill="currentColor"/>
    <path d="M6.4 12.6h2.5l.7 4.05a.9.9 0 0 1-.89 1.05H7.5a.9.9 0 0 1-.87-.67z" fill="currentColor" fillOpacity="0.45"/>
    <circle cx="16.9" cy="10" r="1.5" fill="#FFCC33"/>
  </svg>
);

const HelpIcon = ({ className }: NavIconProps) => (
  <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
    <circle cx="10" cy="10" r="7.8" fill="currentColor" />
    <path
      d="M7.9 7.7a2.2 2.2 0 1 1 2.85 2.35c-.5.17-.75.6-.75 1.05v.4"
      stroke="#FFCC33"
      strokeWidth="1.9"
      strokeLinecap="round"
      fill="none"
    />
    <circle cx="10" cy="14.1" r="1.15" fill="#FFCC33" />
  </svg>
);

const NAV = [
  { label: "Dashboard", Icon: DashboardIcon, href: "/dashboard" },
  { label: "Tools", Icon: ToolsIcon, href: "/tools" },
  { label: "Folders", Icon: FoldersIcon, href: "/folders" },
  // Reachable on every plan. Free accounts land on a locked state that sells
  // the upgrade — greying it out here would hide the feature from the people
  // it is meant to convert. proxy.ts is what actually enforces the gate.
  { label: "AI assistant", Icon: AssistantIcon, href: "/assistant" },
];

export default function SideNav() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sidenav-collapsed") === "true";
  });

  const toggle = () => {
    setCollapsed((c) => {
      localStorage.setItem("sidenav-collapsed", String(!c));
      return !c;
    });
  };

  // Pinned tools — shared store, kept in sync with the Tools page live.
  const pinnedHrefs = usePinnedTools();

  // Unread support replies. Re-checked on navigation so it clears once the
  // teacher opens the conversation, without needing a full reload.
  const [supportUnread, setSupportUnread] = useState(0);
  const [announceUnread, setAnnounceUnread] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      // Both badges clear on navigation, so they are fetched together.
      const [support, announce] = await Promise.all([
        supabase.rpc("my_support_unread"),
        supabase.rpc("my_announcements_unread"),
      ]);
      if (cancelled) return;
      setSupportUnread(Number(support.data ?? 0));
      setAnnounceUnread(Number(announce.data ?? 0));
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const pinnedTools = pinnedHrefs
    .map((href) => TOOLS.find((t) => t.href === href))
    .filter((t): t is (typeof TOOLS)[number] => Boolean(t));

  return (
    <aside
      className={`shrink-0 flex flex-col h-screen sticky top-0 py-8 transition-all duration-300 ${collapsed ? "w-18 px-3" : "w-64 px-6"}`}
      style={{ borderRight: "1px solid #DAD8D0" }}
    >
      <div className="flex items-center justify-between mb-10">
        {/* The wordmark is the way back to the landing page.

            The collapse styles (overflow-hidden, maxWidth, opacity, the
            transition) live on the LINK rather than the image: an anchor keeps
            its own intrinsic 130px box, so leaving them on the <img> would shrink
            the picture while the anchor held the row open and the rail never
            closed up.

            A zero-width anchor is still focusable, which would leave a keyboard
            user tabbing a collapsed rail stranded on an invisible link with no
            way to tell where they are — hence tabIndex/aria-hidden/pointerEvents
            below. No separate "home" affordance is added for the collapsed rail:
            the nav icons stay visible and /dashboard is the app's home, whereas
            this points at the MARKETING page, which a signed-in teacher rarely
            wants. Expanding the rail is one click. */}
        <Link
          href="/"
          aria-label="Jooma home"
          tabIndex={collapsed ? -1 : 0}
          aria-hidden={collapsed}
          className="overflow-hidden transition-all duration-300 shrink-0 rounded-lg"
          style={{
            maxWidth: collapsed ? "0px" : "130px",
            opacity: collapsed ? 0 : 1,
            pointerEvents: collapsed ? "none" : undefined,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo/logo.svg"
            alt="Jooma"
            className="shrink-0"
            style={{ height: 32, width: "auto" }}
          />
        </Link>
        <button
          onClick={toggle}
          className="p-2 border border-line rounded-lg hover:bg-gray-100 transition-colors shrink-0 cursor-pointer"
        >
          {collapsed
            ? <ChevronRight className="w-4 h-4 text-muted" />
            : <ChevronLeft className="w-4 h-4 text-muted" />
          }
        </button>
      </div>

      <nav className="space-y-1 grow">
        {NAV.map(({ label, Icon, href }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          const isDisabled = href === "#";

          if (isDisabled) {
            return (
              <div key={label} className="relative group/nav">
                <div className="flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-2xl text-gray-400 opacity-50 cursor-not-allowed">
                  <Icon className="w-4.5 h-4.5 shrink-0" />
                  <span className="overflow-hidden whitespace-nowrap transition-all duration-300" style={{ maxWidth: collapsed ? "0px" : "160px", opacity: collapsed ? 0 : 1 }}>{label}</span>
                </div>
                <span className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-gray-800 px-2 py-1 text-xs text-white opacity-0 group-hover/nav:opacity-100 transition-opacity z-10">
                  {collapsed ? label : "Coming soon"}
                </span>
              </div>
            );
          }

          return (
            <Link
              key={label}
              href={href}
              className={`group/nav flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-2xl transition-colors ${active ? "bg-[#1a1a1a] text-white" : "text-gray-700 hover:bg-gray-100"}`}
            >
              <Icon className="w-4.5 h-4.5 shrink-0 transition-transform duration-200 ease-out group-hover/nav:scale-110" />
              <span className="overflow-hidden whitespace-nowrap transition-all duration-300" style={{ maxWidth: collapsed ? "0px" : "160px", opacity: collapsed ? 0 : 1 }}>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Pinned tools — pinned from the Tools page */}
      {pinnedTools.length > 0 && (
        collapsed ? (
          <div className="mt-4 flex flex-col items-center gap-1">
            {pinnedTools.map((tool) => {
              return (
                <Link
                  key={tool.href}
                  href={tool.href}
                  title={tool.label}
                  className="hover:opacity-80 transition-opacity"
                >
                  <ToolIcon name={tool.icon} className="w-10 h-10" />
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl p-4" style={{ backgroundColor: "#FAF9F5" }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted">Pinned tools</span>
              <Pin className="w-3.5 h-3.5 text-muted" />
            </div>
            <div className="space-y-0.5">
              {pinnedTools.map((tool) => {
                return (
                  <Link
                    key={tool.href}
                    href={tool.href}
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <ToolIcon name={tool.icon} className="w-8 h-8 shrink-0" />
                    <span className="text-sm font-medium truncate">{tool.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )
      )}

      {/* Announcements — sits with Help at the foot of the rail rather than in
          NAV above, which stays the four places a teacher goes to work. Uses a
          lucide icon to match its neighbour; the NAV items are img/svg. */}
      <Link
        href="/announcements"
        title={collapsed ? "Announcements" : undefined}
        className={`group/nav mt-4 flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-2xl transition-colors ${
          pathname.startsWith("/announcements")
            ? "bg-[#1a1a1a] text-white"
            : "text-gray-700 hover:bg-gray-100"
        }`}
      >
        <span className="relative shrink-0">
          <AnnouncementsIcon className="w-4.5 h-4.5 transition-transform duration-200 ease-out group-hover/nav:scale-110" />
          {announceUnread > 0 && (
            <span
              className="absolute -top-1 -right-1 w-2 h-2 rounded-full"
              style={{ backgroundColor: "#B3261E" }}
            />
          )}
        </span>
        <span
          className="overflow-hidden whitespace-nowrap transition-all duration-300"
          style={{ maxWidth: collapsed ? "0px" : "160px", opacity: collapsed ? 0 : 1 }}
        >
          Announcements
        </span>
        {!collapsed && announceUnread > 0 && (
          <span
            className="ml-auto text-[10px] font-bold rounded-full px-1.5 py-0.5 text-white shrink-0"
            style={{ backgroundColor: "#B3261E" }}
          >
            {announceUnread}
          </span>
        )}
      </Link>

      {/* Help — anchored below the pinned card. The `grow` on <nav> above keeps
          this at the bottom of the rail whatever else is rendered. */}
      <Link
        href="/help"
        title={collapsed ? "Help" : undefined}
        className={`group/nav mt-1 flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-2xl transition-colors ${
          pathname.startsWith("/help")
            ? "bg-[#1a1a1a] text-white"
            : "text-gray-700 hover:bg-gray-100"
        }`}
      >
        <span className="relative shrink-0">
          <HelpIcon className="w-4.5 h-4.5 transition-transform duration-200 ease-out group-hover/nav:scale-110" />
          {supportUnread > 0 && (
            <span
              className="absolute -top-1 -right-1 w-2 h-2 rounded-full"
              style={{ backgroundColor: "#B3261E" }}
            />
          )}
        </span>
        <span
          className="overflow-hidden whitespace-nowrap transition-all duration-300"
          style={{ maxWidth: collapsed ? "0px" : "160px", opacity: collapsed ? 0 : 1 }}
        >
          Help
        </span>
        {!collapsed && supportUnread > 0 && (
          <span
            className="ml-auto text-[10px] font-bold rounded-full px-1.5 py-0.5 text-white shrink-0"
            style={{ backgroundColor: "#B3261E" }}
          >
            {supportUnread}
          </span>
        )}
      </Link>
    </aside>
  );
}
