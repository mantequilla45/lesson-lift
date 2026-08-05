import { requireAdmin } from "@/app/lib/auth/admin";
import { TOOLS } from "@/app/lib/tools";
import { typeLabel } from "@/app/lib/toolRunDisplay";
import AdminUsageTable, { type AdminUsageRow } from "./AdminUsageTable";
import ThinnestMargins, { type MarginRow } from "./ThinnestMargins";

// Slugs recorded by the Slideshow Generator editor when its actions are used
// standalone (no parentTool). They're grouped under the generate-slideshow
// umbrella row rather than listed as separate top-level tools.
const SLIDESHOW_SUBTOOLS = [
  "generate-audio",
  "generate-lesson-outline",
  "suggest-vocabulary",
  "suggest-subject",
  "find-youtube",
  "edit-text",
  "generate-activity",
];

export const dynamic = "force-dynamic";

interface ReportRow {
  tool_slug: string;
  generations: number;
  total_tokens: number;
  text_cost_usd: number;
  asset_cost_usd: number;
  cost_usd: number;
  last_used: string | null;
}

interface StepRow {
  tool_slug: string;
  step: string;
  slide_label: string | null;
  generations: number;
  cost_usd: number;
}

export default async function AdminUsagePage() {
  const { supabase } = await requireAdmin();
  const [{ data }, { data: stepData }, { data: marginData }] = await Promise.all([
    supabase.rpc("admin_tool_usage_report"),
    supabase.rpc("admin_tool_step_breakdown"),
    supabase.rpc("admin_thinnest_margins", { lim: 8 }),
  ]);
  const report = (data ?? []) as ReportRow[];
  const steps = (stepData ?? []) as StepRow[];
  const margins = (marginData ?? []) as MarginRow[];

  // Step-breakdown children for non-slideshow multi-step tools (deck text /
  // audio script / etc.). The slideshow gets its own sub-tool breakdown below.
  type ChildRow = NonNullable<AdminUsageRow["children"]>[number];
  const childrenBySlug = new Map<string, ChildRow[]>();
  for (const s of steps) {
    if (s.tool_slug === "generate-slideshow") continue;
    const arr = childrenBySlug.get(s.tool_slug) ?? [];
    arr.push({ label: s.slide_label ?? s.step, cost_usd: Number(s.cost_usd) });
    childrenBySlug.set(s.tool_slug, arr);
  }

  // Merge the full tool catalog with what's been used so every tool shows,
  // even at zero.
  const bySlug = new Map(report.map((r) => [r.tool_slug, r]));
  const catalogSlugs = TOOLS.map((t) => t.href.replace("/tools/", ""));
  const allSlugs = Array.from(new Set([...catalogSlugs, ...report.map((r) => r.tool_slug)]));

  const toRow = (slug: string): AdminUsageRow => {
    const r = bySlug.get(slug);
    const children = childrenBySlug.get(slug);
    return {
      tool_slug: slug,
      generations: r ? Number(r.generations) : 0,
      cost_usd: r ? Number(r.cost_usd) : 0,
      last_used: r?.last_used ?? null,
      children: children && children.length > 1 ? children : undefined,
    };
  };

  // The slideshow editor sub-tools become children of the generate-slideshow
  // umbrella rather than separate top-level rows.
  const subtools = new Set(SLIDESHOW_SUBTOOLS);
  const subtoolChildren = SLIDESHOW_SUBTOOLS.map((slug) => bySlug.get(slug))
    .filter((r): r is ReportRow => !!r && Number(r.generations) > 0)
    .map((r) => ({
      label: typeLabel(r.tool_slug),
      cost_usd: Number(r.cost_usd),
      generations: Number(r.generations),
      last_used: r.last_used,
      tool_slug: r.tool_slug,
    }))
    .sort((a, b) => b.cost_usd - a.cost_usd);

  const rows: AdminUsageRow[] = allSlugs
    .filter((slug) => slug !== "generate-slideshow" && !subtools.has(slug))
    .map(toRow);

  // Slideshow umbrella: its own deck cost plus every sub-tool, with the deck
  // line and sub-tools as the expandable breakdown.
  if (bySlug.has("generate-slideshow") || subtoolChildren.length > 0) {
    const own = toRow("generate-slideshow");
    const childCost = subtoolChildren.reduce((sum, c) => sum + c.cost_usd, 0);
    const children = [
      {
        label: "Decks (text, images & audio)",
        cost_usd: own.cost_usd,
        generations: own.generations,
        last_used: own.last_used,
        tool_slug: "generate-slideshow",
      },
      ...subtoolChildren,
    ];
    rows.push({
      ...own,
      cost_usd: own.cost_usd + childCost,
      children: children.length > 1 ? children : undefined,
    });
  }

  rows.sort((a, b) => b.cost_usd - a.cost_usd || a.tool_slug.localeCompare(b.tool_slug));

  const month = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: "#1a1a1a" }}>
        Usage
      </h1>
      <p className="text-sm mb-6" style={{ color: "#8a8078" }}>
        Cost per tool across all users for {month}, with per-generation cost and 10x / 100x
        projections. Every tool is listed; unused tools show zero. Use Select to reset a tool&apos;s
        recorded usage.
      </p>

      <AdminUsageTable rows={rows} />

      <div className="mt-6">
        <ThinnestMargins rows={margins} />
      </div>
    </>
  );
}
