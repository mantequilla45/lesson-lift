"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, LifeBuoy, Megaphone, Pin } from "lucide-react";
import { useEffect, useState } from "react";
import { TOOLS } from "@/app/lib/tools";
import ToolIcon from "@/app/components/ToolIcon";
import { createClient } from "@/app/lib/auth/client";
import { usePinnedTools } from "@/app/lib/usePinnedTools";

const NAV = [
  { label: "Dashboard", icon: "/icons/dashboard.svg", href: "/dashboard" },
  { label: "Tools", icon: "/icons/tools.svg", href: "/tools" },
  { label: "Folders", icon: "/icons/folders.svg", href: "/folders" },
  // Reachable on every plan. Free accounts land on a locked state that sells
  // the upgrade — greying it out here would hide the feature from the people
  // it is meant to convert. proxy.ts is what actually enforces the gate.
  { label: "AI assistant", icon: "/icons/ai-assistant.svg", href: "/assistant" },
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
        {NAV.map(({ label, icon, href }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          const isDisabled = href === "#";

          // CSS filter normalises any icon colour: dark bg → white, light bg → black
          const iconFilter = active
            ? "brightness(0) invert(1)"
            : "brightness(0)";

          if (isDisabled) {
            return (
              <div key={label} className="relative group/nav">
                <div className="flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-2xl text-gray-400 opacity-50 cursor-not-allowed">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={icon} alt="" width={18} height={18} className="shrink-0" style={{ filter: "brightness(0) opacity(0.4)" }} />
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
              className={`flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-2xl transition-colors ${active ? "bg-[#1a1a1a] text-white" : "text-gray-700 hover:bg-gray-100"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={icon} alt="" width={18} height={18} className="shrink-0" style={{ filter: iconFilter }} />
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
        className={`mt-4 flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-2xl transition-colors ${
          pathname.startsWith("/announcements")
            ? "bg-[#1a1a1a] text-white"
            : "text-gray-700 hover:bg-gray-100"
        }`}
      >
        <span className="relative shrink-0">
          <Megaphone className="w-4.5 h-4.5" />
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
        className={`mt-1 flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-2xl transition-colors ${
          pathname.startsWith("/help")
            ? "bg-[#1a1a1a] text-white"
            : "text-gray-700 hover:bg-gray-100"
        }`}
      >
        <span className="relative shrink-0">
          <LifeBuoy className="w-4.5 h-4.5" />
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
