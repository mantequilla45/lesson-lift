"use client";

import Link from "next/link";
import { useState } from "react";
import { CiSearch } from "react-icons/ci";
import { Pin } from "lucide-react";
import AppShell from "@/app/components/layout/AppShell";
import Card from "@/app/components/ui/Card";
import ToolIcon from "@/app/components/ToolIcon";
import { TOOLS } from "@/app/lib/tools";
import { usePinnedTools, togglePin } from "@/app/lib/usePinnedTools";

export default function ToolsGrid({ disabledSlugs }: { disabledSlugs: string[] }) {
  const [query, setQuery] = useState("");
  // Pinned tools live in a shared localStorage-backed store (useSyncExternalStore),
  // so the Tools grid and SideNav stay in sync the instant a pin changes.
  const pinnedHrefs = usePinnedTools();

  const q = query.toLowerCase().trim();
  // Tools an admin has switched off in /admin/tools. Resolved on the server and
  // passed in, rather than fetched here: filtering client-side would render the
  // disabled tools for a frame before removing them, which reads as a glitch.
  // The proxy blocks the route and the API regardless — this only stops us
  // advertising something that would refuse.
  const disabled = new Set(disabledSlugs);
  const available = TOOLS.filter((t) => !disabled.has(t.href.replace("/tools/", "")));

  const pinned = available.filter((t) => pinnedHrefs.includes(t.href));
  const rest = available.filter((t) => !pinnedHrefs.includes(t.href));

  const filteredPinned = pinned.filter(
    (t) => !q || t.label.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
  );
  const filteredRest = rest.filter(
    (t) => !q || t.label.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
  );

  return (
    <AppShell title="Tools">
          {/* Hero search */}
          <Card>
            <h3 className="text-xl sm:text-2xl font-medium mb-5">What would you like to do?</h3>
            <div className="relative">
              <CiSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for a tool"
                className="w-full pl-12 pr-3 py-3 border border-[#F1EFE3] font-light rounded-2xl bg-white text-base sm:text-sm placeholder-[#A5A5A5] focus:outline-none focus:border-line transition-all"
              />
            </div>
          </Card>

          <Card>
            {/* Pinned */}
            {filteredPinned.length > 0 && (
              <section className="mb-5">
                <div className="flex items-center gap-4 mb-5">
                  <h4 className="text-sm text-muted shrink-0">Pinned</h4>
                  <div className="h-px bg-muted/30 w-full" />
                </div>
                {/* min(350px, 100%) so the track can never demand more width
                    than its container — a bare 350px minimum forced horizontal
                    overflow on any phone. */}
                <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(350px, 100%), 1fr))" }}>
                  {filteredPinned.map((tool) => (
                    <ToolCard key={tool.href} tool={tool} isPinned onTogglePin={togglePin} />
                  ))}
                </div>
              </section>
            )}

            {/* All tools */}
            {filteredRest.length > 0 && (
              <section>
                <div className="flex items-center gap-4 mb-5">
                  <h4 className="text-sm text-muted shrink-0">All tools</h4>
                  <div className="h-px bg-muted/30 w-full" />
                </div>
                {/* min(350px, 100%) so the track can never demand more width
                    than its container — a bare 350px minimum forced horizontal
                    overflow on any phone. */}
                <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(350px, 100%), 1fr))" }}>
                  {filteredRest.map((tool) => (
                    <ToolCard key={tool.href} tool={tool} isPinned={false} onTogglePin={togglePin} />
                  ))}
                </div>
              </section>
            )}
          </Card>

          {filteredPinned.length === 0 && filteredRest.length === 0 && (
            <p className="text-sm text-muted text-center py-12 sm:py-16">No tools match your search.</p>
          )}
    </AppShell>
  );
}

function ToolCard({
  tool,
  isPinned,
  onTogglePin,
}: {
  tool: typeof TOOLS[number];
  isPinned: boolean;
  onTogglePin: (href: string) => void;
}) {
  return (
    // Link is a SIBLING overlay (not a parent), so clicking the pin button never
    // hits the anchor element — that's what prevents nextjs-toploader from firing.
    // `title` carries the full description: it is clamped to two lines below, and
    // the browser's own tooltip is the way to read the rest.
    <div
      title={tool.description}
      className="group relative flex gap-4 items-start p-5 border border-line rounded-2xl transition-all duration-200 ease-out hover:bg-[#F1EFE3] hover:border-[#F1EFE3] hover:-translate-y-0.5 hover:shadow-[0_6px_16px_-6px_rgba(28,27,27,0.25)]"
    >
      <Link
        href={tool.href}
        aria-label={tool.label}
        className="absolute inset-0 rounded-2xl z-0"
      />
      <div className="relative z-10 shrink-0 pointer-events-none">
        <ToolIcon name={tool.icon} className="w-10 h-10 transition-transform duration-200 ease-out group-hover:scale-110 group-hover:-rotate-3" />
      </div>
      <div className="relative z-10 min-w-0 flex-1 pointer-events-none">
        <h5 className="font-semibold text-md mb-0.5">{tool.label}</h5>
        <p className="text-sm text-muted font-light line-clamp-2">{tool.description}</p>
      </div>
      <button
        onClick={() => onTogglePin(tool.href)}
        title={isPinned ? "Unpin" : "Pin to top"}
        aria-label={isPinned ? "Unpin tool" : "Pin tool to top"}
        className={`relative z-20 w-7 h-7 rounded-full flex items-center justify-center transition-all shrink-0 ${
          isPinned
            ? "text-violet-600 opacity-100"
            : "text-gray-400 opacity-0 group-hover:opacity-100 hover:text-violet-600 hover:bg-white"
        }`}
      >
        <Pin className={`w-3.5 h-3.5 ${isPinned ? "fill-current" : ""}`} />
      </button>
    </div>
  );
}
