/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical } from "lucide-react";
import ToolIcon from "@/app/components/ToolIcon";
import AppShell from "@/app/components/layout/AppShell";
import Card from "@/app/components/ui/Card";
import { minutesSavedFor } from "@/app/lib/tools";
import { listRecentRuns, type ToolRun } from "@/app/lib/toolRuns";
import { toolForSlug, typeLabel, formatDate } from "@/app/lib/toolRunDisplay";
import type { CopyMap } from "@/app/lib/copy";
import UpgradeGate from "@/app/components/UpgradeGate";
import DashboardAssistantCard from "@/app/components/assistant/DashboardAssistantCard";

// Runs are fetched client-side, so this stays a client component; the empty-state
// wording arrives as a prop from the server wrapper in app/dashboard/page.tsx
// because app/lib/copy.ts is server-only.
export default function DashboardView({
  copy,
}: {
  copy: Pick<CopyMap, "dash.empty.title" | "dash.empty.body">;
}) {
  const router = useRouter();
  const [runs, setRuns] = useState<ToolRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listRecentRuns(100)
      .then(setRuns)
      .catch(() => setRuns([]))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const count = (slug: string) => runs.filter((r) => r.tool_slug === slug).length;
    // Sum per-tool minute estimates (see TOOL_MINUTES_SAVED) and convert to hours.
    const minutes = runs.reduce((sum, r) => sum + minutesSavedFor(r.tool_slug), 0);
    return {
      lessonPlans: count("lesson-planner"),
      worksheets: count("worksheet-generator"),
      quizzes: count("quiz-generator"),
      hoursSaved: Math.round(minutes / 60),
    };
  }, [runs]);

  const recent = runs.slice(0, 8);

  return (
    /* UpgradeGate catches a 402 from the assistant card's plan gate or spend
       ceiling and opens the upgrade modal. The dashboard is a sibling of
       /tools, so it does not inherit the one mounted in that layout. */
    <AppShell title="Dashboard" slot={<UpgradeGate />}>
      {/* Activity overview */}
      <Card>
            <div className="flex items-start justify-between gap-3 mb-1">
              <h3 className="text-xl sm:text-2xl font-medium min-w-0">Here&apos;s your activity overview</h3>
              <button
                onClick={() => router.push("/analytics")}
                className="text-sm font-medium text-muted hover:text-dark transition-colors cursor-pointer"
              >
                See all
              </button>
            </div>
            <p className="text-sm text-muted font-light mb-6">
              {stats.hoursSaved} hours saved = more time for coffee or creativity!
            </p>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                bg="bg-[#EF233C]/10" icon={<img src="/icons/lesson-plan.svg" alt="" width={36} height={36} />}
                value={`${stats.lessonPlans} lesson plans`} sub="Created with Jooma"
              />
              <StatCard
                bg="bg-[#16DB65]/10" icon={<img src="/icons/clock.svg" alt="" width={36} height={36} />}
                value={`${stats.hoursSaved} hours`} sub="Estimated time saved"
              />
              <StatCard
                bg="bg-[#FFDC21]/10" icon={<img src="/icons/flashcards.svg" alt="" width={36} height={36} />}
                value={`${stats.quizzes} quizzes`} sub="Ready to play"
              />
              <StatCard
                bg="bg-[#3B6FF5]/10" icon={<img src="/icons/worksheet.svg" alt="" width={36} height={36} />}
                value={`${stats.worksheets} worksheets`} sub="Ready to use"
              />
            </div>
          </Card>

          {/* AI assistant — an entry point, not a second chat surface. Starting
              a conversation here continues it at /assistant/[id]. */}
          <DashboardAssistantCard />

          {/* Recently added */}
          <Card>
            <div className="flex items-center justify-between gap-3 mb-6">
              <h3 className="text-lg sm:text-xl font-medium min-w-0">
                Recently added{" "}
                <span className="text-muted">({runs.length})</span>
              </h3>
              <button
                onClick={() => router.push("/analytics")}
                className="text-sm font-medium text-muted hover:text-dark transition-colors cursor-pointer"
              >
                See all
              </button>
            </div>

            {loading ? (
              <p className="text-sm text-muted py-10 text-center">Loading…</p>
            ) : recent.length === 0 ? (
              // Two lines rather than the single sentence this used to be, so the
              // dash.empty.title / dash.empty.body pair in /admin/copy has
              // somewhere to land.
              <div className="py-10 text-center">
                <p className="text-base font-medium text-dark mb-1">
                  {copy["dash.empty.title"]}
                </p>
                <p className="text-sm text-muted">{copy["dash.empty.body"]}</p>
              </div>
            ) : (
              /* Six columns will not fit a phone, so the table scrolls inside
                 its own box rather than widening the page. Works because
                 AppShell's <main> carries min-w-0. Same pattern as
                 app/account/billing/UsageTable.tsx. */
              <div className="overflow-x-auto -mx-1 px-1">
              <table className="w-full text-sm min-w-180">
                <thead>
                  <tr className="text-left text-muted border-b border-line">
                    <th className="font-normal pb-3 pr-4">Name</th>
                    <th className="font-normal pb-3 pr-4">Type</th>
                    <th className="font-normal pb-3 pr-4">Subject</th>
                    <th className="font-normal pb-3 pr-4">Year</th>
                    <th className="font-normal pb-3 pr-4">Date</th>
                    <th className="pb-3 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {recent.map((run) => {
                    const tool = toolForSlug(run.tool_slug);
                    const input = run.input as Record<string, unknown>;
                    const subject = (input.subject as string) || "—";
                    const year = (input.yearGroup as string) || "—";
                    return (
                      <tr
                        key={run.id}
                        // ?run= reopens THIS run. Without it the row opened an
                        // empty tool and silently discarded what was clicked.
                        onClick={() => tool && router.push(`${tool.href}?run=${run.id}`)}
                        className="border-b border-line/60 hover:bg-[#F1EFE3] transition-colors cursor-pointer"
                      >
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-3">
                            <ToolIcon name={tool?.icon ?? ""} className="w-8 h-8 shrink-0" />
                            <span className="font-medium text-dark truncate max-w-xs">
                              {run.title?.trim() || "Untitled"}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-muted">{typeLabel(run.tool_slug)}</td>
                        <td className="py-3 pr-4 text-muted">{subject}</td>
                        <td className="py-3 pr-4 text-muted">{year}</td>
                        <td className="py-3 pr-4 text-muted whitespace-nowrap">{formatDate(run.created_at)}</td>
                        <td className="py-3">
                          <button
                            aria-label="More"
                            onClick={(e) => e.stopPropagation()}
                            className="w-7 h-7 flex items-center justify-center rounded-md text-muted hover:bg-white transition-colors cursor-pointer"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            )}
          </Card>
    </AppShell>
  );
}

function StatCard({
  bg, icon, value, sub,
}: {
  bg: string; icon: React.ReactNode; value: string; sub: string;
}) {
  return (
    <div className={`relative rounded-2xl p-5 sm:p-6 ${bg} min-h-28 sm:min-h-32 flex flex-col justify-end`}>
      <span className="absolute top-5 right-5">
        {icon}
      </span>
      <p className="text-xl font-semibold text-dark">{value}</p>
      <p className="text-xs text-muted mt-0.5">{sub}</p>
    </div>
  );
}
