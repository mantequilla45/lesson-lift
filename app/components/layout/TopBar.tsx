"use client";

import { useRef, useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Bell, UserCircle, LogOut } from "lucide-react";
import { CiSearch } from "react-icons/ci";
import { TOOLS } from "@/app/lib/tools";
import { createClient } from "@/app/lib/auth/client";

const TAG_COLORS: Record<string, string> = {
  Planning: "bg-blue-100 text-blue-700",
  Literacy: "bg-amber-100 text-amber-700",
  Assessment: "bg-violet-100 text-violet-700",
  "Early Years": "bg-emerald-100 text-emerald-700",
  SEND: "bg-emerald-100 text-emerald-700",
  Leadership: "bg-rose-100 text-rose-700",
};

interface TopBarProps {
  title: string;
  /** @deprecated — search is now always visible and self-contained */
  showSearch?: boolean;
  searchValue?: string;
  onSearchChange?: (v: string) => void;
}

export default function TopBar({ title, onSearchChange }: TopBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [announceUnread, setAnnounceUnread] = useState(0);
  const profileRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });
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

  const trimmed = query.trim().toLowerCase();
  const results = trimmed
    ? TOOLS.filter(
        (t) =>
          t.label.toLowerCase().includes(trimmed) ||
          t.description.toLowerCase().includes(trimmed) ||
          t.tag.toLowerCase().includes(trimmed)
      ).slice(0, 6)
    : [];

  // Sync to parent (home page grid filter) if a handler is provided
  useEffect(() => {
    onSearchChange?.(query);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (href: string) => {
    setQuery("");
    setOpen(false);
    router.push(href);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setQuery("");
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results.length > 0) {
      handleSelect(results[activeIndex].href);
    }
  };

  return (
    <header className="flex items-center justify-between px-10 py-5 shrink-0">
      <h2 className="text-2xl font-bold shrink-0">{title}</h2>
      <div className="flex items-center gap-3">

        {/* Search */}
        <div className="relative" ref={wrapperRef}>
          <CiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted pointer-events-none z-10" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setActiveIndex(0);
            }}
            onFocus={() => { if (query.trim()) setOpen(true); }}
            onKeyDown={handleKeyDown}
            placeholder="Search tools"
            className="w-64 pl-9 pr-4 py-2 border border-line font-light rounded-2xl text-sm placeholder-muted focus:outline-none focus:border-gray-400 transition-all bg-white"
          />

          {/* Dropdown */}
          {open && results.length > 0 && (
            <div className="absolute right-0 top-full mt-2 w-96 bg-white border border-gray-200 rounded-2xl shadow-lg z-50 overflow-hidden">
              <p className="px-4 pt-3 pb-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Tools
              </p>
              <ul>
                {results.map((tool, i) => (
                  <li key={tool.href}>
                    <button
                      type="button"
                      onMouseDown={() => handleSelect(tool.href)}
                      onMouseEnter={() => setActiveIndex(i)}
                      className={`w-full flex items-start gap-3 px-4 py-3 transition-colors text-left cursor-pointer ${i === activeIndex ? "bg-gray-100" : "hover:bg-gray-50"}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-gray-900 truncate">
                            {tool.label}
                          </span>
                          <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${TAG_COLORS[tool.tag] ?? "bg-gray-100 text-gray-600"}`}>
                            {tool.tag}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-1">{tool.description}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* No results */}
          {open && trimmed && results.length === 0 && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-2xl shadow-lg z-50 px-4 py-4">
              <p className="text-sm text-gray-500">No tools match <span className="font-medium text-gray-700">&quot;{query}&quot;</span></p>
            </div>
          )}
        </div>

        <div className="relative group/storage">
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
