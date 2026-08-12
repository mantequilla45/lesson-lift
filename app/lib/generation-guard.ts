// Server-side enforcement of the plan gates (see plans.ts). This is the trusted
// path: it runs in proxy.ts on every gated request, so it can't be bypassed
// from the client. The limits themselves live in plans.ts.
//
// There are two gates, and the distinction matters:
//
//   COUNT gate (Free)   — 1 generation a day, 5 a month, global across all
//                         tools. Only applies to requests that ARE a
//                         generation, so it needs GENERATION_PATHS below.
//   COST gate (Pro)     — £1.50 of measured provider spend a month. Denominated
//                         in real cost, so it is path-agnostic: anything that
//                         records spend counts, and no list needs maintaining.
//
// Both read from a single my_generation_gate() RPC so one request costs one
// round-trip.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AI_SPEND_CEILING_PENCE, PLAN_CREDITS, asPlanId, generationGate } from "./plans";

// The API routes that count as one generation against the cap. Each is a tool's
// primary endpoint and produces exactly one saved tool_run, so counting these
// matches the user-visible notion of "a generation".
//
// Deliberately EXCLUDED (do not count toward the limit): /api/modify
// (refinements of an existing output) and all utility/sub-asset endpoints
// (fetch-image, generate-image, generate-audio, generate-outline,
// generate-activity, generate-slideshow, suggest-vocabulary, find-youtube,
// extract-resource, upload-image, upload-video). When a new tool is added,
// add its route here or it will go uncapped.
const GENERATION_PATHS: ReadonlySet<string> = new Set([
  "/api/assembly-planner",
  "/api/behaviour-support-plan",
  "/api/comprehension-generator",
  "/api/cover-lesson",
  "/api/cpd-slideshow",
  "/api/ect-report-writer",
  "/api/exam-question-generator",
  "/api/eyfs-action-plan",
  "/api/eyfs-planner",
  "/api/homework-generator",
  "/api/inspection-prep",
  "/api/learning-walk-report",
  "/api/lesson-observation-report",
  "/api/lesson-planner",
  "/api/lesson-slideshow",
  "/api/letter-writer",
  "/api/medium-term-planner",
  "/api/meeting-planner",
  "/api/model-answer-generator",
  "/api/model-text-generator",
  "/api/newsletter-writer",
  "/api/one-page-profile",
  "/api/performance-management",
  "/api/phonics-support",
  "/api/policy-generator",
  "/api/pupil-premium-planner",
  "/api/quiz-generator",
  "/api/report-writer",
  "/api/risk-assessment",
  "/api/school-improvement-plan",
  "/api/sensory-activities",
  "/api/smart-targets",
  "/api/targeted-intervention",
  "/api/topic-overview",
  "/api/worksheet-generator",
]);

/** True when this request is an AI generation subject to the Free count caps. */
export function isGenerationRequest(method: string, pathname: string): boolean {
  return method === "POST" && GENERATION_PATHS.has(pathname);
}

// Routes that spend real money but do NOT produce a saved generation. They are
// deliberately absent from GENERATION_PATHS — a refinement must not burn one of
// a free user's five — but they must still be blocked once a paid user has
// exhausted their spend ceiling, or the ceiling leaks.
const COST_BEARING_PATHS: ReadonlySet<string> = new Set([
  "/api/modify",
  "/api/generate",
  "/api/generate-image",
  "/api/generate-audio",
  "/api/generate-activity",
  "/api/generate-lesson-outline",
  "/api/suggest-vocabulary",
  "/api/suggest-subject",
  "/api/edit-text",
  "/api/find-youtube",
  "/api/extract-resource",
]);

/** True when this request should be checked against the spend ceiling. Every
 *  generation qualifies, plus the sub-asset and refinement routes above. */
export function isCostBearingRequest(method: string, pathname: string): boolean {
  return (
    method === "POST" &&
    (GENERATION_PATHS.has(pathname) || COST_BEARING_PATHS.has(pathname))
  );
}

export type QuotaBlockReason = "free_daily" | "free_monthly" | "credit_exhausted";

export interface QuotaResult {
  blocked: true;
  reason: QuotaBlockReason;
  /** Human-readable copy, safe to render directly. */
  message: string;
  /** Which CTA the client should offer. */
  action: "upgrade" | "topup";
  // Count gates only:
  used?: number;
  limit?: number;
  /** ISO timestamp when the daily allowance resets (next UTC midnight). */
  resetsAt?: string;
  // Cost gate only (pence):
  spendPence?: number;
  ceilingPence?: number;
}

interface GateRow {
  plan: string | null;
  is_admin: boolean | null;
  used_today: number | null;
  used_month: number | null;
  spend_pence: number | string | null;
  credit_pence: number | string | null;
}

/** Next UTC midnight, as an ISO string. */
function nextUtcMidnight(): string {
  const d = new Date();
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1),
  ).toISOString();
}

/**
 * Resolve every gate for the caller in one round-trip.
 *
 * Returns `null` when the request is allowed — including for admins, who are
 * exempt so they can test tools freely without upgrading, and for plans with
 * neither a ceiling nor a count cap.
 *
 * `countsAsGeneration` should be true only for GENERATION_PATHS; the cost
 * ceiling is checked either way.
 */
export async function checkAllGates(
  supabase: SupabaseClient,
  opts: { countsAsGeneration: boolean },
): Promise<QuotaResult | null> {
  const { data, error } = await supabase.rpc("my_generation_gate");
  if (error) {
    // Fail OPEN. A telemetry/DB blip must not take the whole product down; the
    // worst case is a little unmetered spend, which the admin margin report
    // will surface. Failing closed would block paying users on a transient.
    console.warn("[generation-guard] my_generation_gate failed:", error.message);
    return null;
  }

  const row = (Array.isArray(data) ? data[0] : data) as GateRow | undefined;
  if (!row) return null;
  if (row.is_admin) return null; // admins bypass every gate

  const plan = asPlanId(row.plan);

  // ── 1. Cost ceiling (path-agnostic) ──
  // Checked first: it is the margin guard, and on plans that have one there is
  // no count cap to fall through to anyway.
  const ceiling = AI_SPEND_CEILING_PENCE[plan];
  if (ceiling !== null) {
    const spendPence = Number(row.spend_pence ?? 0);
    const creditPence = Number(row.credit_pence ?? 0);
    const allowance = ceiling + creditPence;
    if (spendPence >= allowance) {
      return {
        blocked: true,
        reason: "credit_exhausted",
        action: "topup",
        // Credits, not pence: the internal meter is model spend, but naming a
        // pound figure for the ALLOWANCE next to the subscription price reads as
        // poor value. The £1.50 top-up PRICE is fine to state — they pay it.
        message:
          `You've used this month's ${PLAN_CREDITS.toLocaleString("en-GB")} credits. ` +
          `Add ${PLAN_CREDITS.toLocaleString("en-GB")} more for £1.50 — they last ` +
          `until the end of the month.`,
        spendPence,
        ceilingPence: allowance,
      };
    }
  }

  // ── 2. Free count caps (generations only) ──
  if (opts.countsAsGeneration) {
    const gate = generationGate(
      plan,
      Number(row.used_month ?? 0),
      Number(row.used_today ?? 0),
    );
    if (!gate.allowed) {
      if (gate.reason === "free_monthly") {
        return {
          blocked: true,
          reason: "free_monthly",
          action: "upgrade",
          message:
            `You've used all ${gate.limit} of your free generations this month. ` +
            "Upgrade to Pro for £7.99 a month.",
          used: gate.used,
          limit: gate.limit ?? undefined,
        };
      }
      return {
        blocked: true,
        reason: "free_daily",
        action: "upgrade",
        message:
          "You've used your free generation for today. Free accounts get 1 a " +
          "day, 5 a month — your next one unlocks at midnight UTC. Upgrade to " +
          "Pro for £7.99 a month.",
        used: gate.usedToday,
        limit: gate.dailyLimit ?? undefined,
        resetsAt: nextUtcMidnight(),
      };
    }
  }

  return null;
}

/** The 402 body every gate returns. Shared so the proxy and any route that
 *  self-gates (see /api/generate-slideshow) can't drift apart. */
export function quotaBlockBody(q: QuotaResult) {
  return {
    error: q.message,
    // Unchanged for the count gates so existing clients keep working; `reason`
    // carries the new granularity.
    code:
      q.reason === "credit_exhausted"
        ? "ai_credit_exhausted"
        : "generation_limit_reached",
    reason: q.reason,
    action: q.action,
    ...(q.used !== undefined ? { used: q.used } : {}),
    ...(q.limit !== undefined ? { limit: q.limit } : {}),
    ...(q.resetsAt ? { resetsAt: q.resetsAt } : {}),
    ...(q.spendPence !== undefined ? { spendPence: q.spendPence } : {}),
    ...(q.ceilingPence !== undefined ? { ceilingPence: q.ceilingPence } : {}),
  };
}

/** Standard headers for a quota block. `x-upgrade-required` is retained because
 *  UpgradeGate keys off it — an unmodified client still shows something. */
export const QUOTA_BLOCK_HEADERS = { "x-upgrade-required": "1" } as const;
