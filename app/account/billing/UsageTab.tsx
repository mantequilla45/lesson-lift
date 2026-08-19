import { createClient } from "@/app/lib/auth/server";
import UsageTable, { type ReportRow } from "./UsageTable";

// Usage: per-tool credit use for the current calendar month, with per-generation
// use and 10/100-generation projections. Figures come from exact recorded usage
// (text from the token counts the provider bills on, images and audio per unit),
// converted to credits inside the my_tool_usage_report() RPC so this table and
// the allowance meter can never disagree about the same month.
export default async function UsageTab() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_tool_usage_report");

  // An explicit failure state, because the silent one is genuinely confusing:
  // if the credits migration hasn't been applied yet the OLD function is still
  // live, returns *_usd columns, and every credit cell renders "—" as though
  // the teacher had simply not used anything.
  if (error) {
    return (
      <div
        className="rounded-2xl p-6 border text-sm"
        style={{ backgroundColor: "#FAF9F5", borderColor: "#DAD8D0", color: "#6b6055" }}
      >
        Usage figures are temporarily unavailable. Your credit balance on the
        Overview tab is unaffected.
      </div>
    );
  }

  const rows = (data ?? []) as ReportRow[];

  // Dev-only tripwire for the "forgot to run supabase db push" case described
  // above. Costs nothing in production and turns a puzzling empty table into a
  // one-line explanation.
  if (process.env.NODE_ENV !== "production" && rows.length > 0) {
    if ("cost_usd" in (rows[0] as unknown as Record<string, unknown>)) {
      console.warn(
        "[usage] my_tool_usage_report() is still returning cost_usd — apply " +
          "supabase/migrations/20260819000000_usage_report_credits.sql (supabase db push).",
      );
    }
  }

  const month = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return (
    <>
      <p className="text-sm mb-4" style={{ color: "#8a8078" }}>
        Credits used per tool in {month}.
      </p>

      <UsageTable rows={rows} />

      {/* No provider names, no dollar figures, no token counts. Credits are the
          unit teachers are sold and the only one they should have to reason
          about — see app/lib/plans.ts. */}
      <p className="text-xs mt-4" style={{ color: "#8a8078" }}>
        Credits are Jooma&apos;s unit for AI use. Per generation is this month&apos;s actual use
        divided by the number of generations; Next 10 and Next 100 are estimates at that same
        rate, so they&apos;ll move as your mix of tools changes. Your remaining balance is on the
        Overview tab and resets on the 1st.
      </p>
    </>
  );
}
