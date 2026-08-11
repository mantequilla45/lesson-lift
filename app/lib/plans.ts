// ── Plan gates — single source of truth ──────────────────────────────────────
// Every feature limit and entitlement is defined here. The pricing page, the
// usage counters, and the runtime gates all read from this config so a plan
// change in one place propagates everywhere.

export type PlanId = "free" | "pro" | "max" | "school";

export type ExportFormat = "pdf" | "docx" | "pptx";

export interface PlanLimits {
  /**
   * Max AI generations per calendar day (UTC). `null` = no daily cap.
   * GLOBAL across all tools, not per tool — one generation a day means the
   * whole product is used up for the day, whichever tool spent it.
   */
  dailyGenerations: number | null;
  /** Max AI generations per calendar month. `null` = unlimited. Also global.
   *  A hard ceiling: reaching it blocks until the 1st even on a fresh day. */
  monthlyGenerations: number | null;
  /**
   * AI-image slideshows included per month. Each costs ~33x a text resource,
   * so this is the single number that decides whether a plan makes money.
   * `0` = not available on this plan.
   */
  aiImageSlideshows: number;
  /** Exported files carry a "Made with Jooma" watermark. */
  watermark: boolean;
  /** Export formats this plan may use. */
  exportFormats: ExportFormat[];
  /** Curriculum alignment depth. */
  curriculumAlignment: "limited" | "full";
  /** Outputs can be edited in the editor before export. */
  editableOutputs: boolean;
  /** Save & organise a personal resource library. */
  saveLibrary: boolean;
  /** Priority support queue. */
  prioritySupport: boolean;
  // ── School-only capabilities ──
  multiUser: boolean;
  sharedLibrary: boolean;
  adminDashboard: boolean;
  usageAnalytics: boolean;
  schoolBranding: boolean;
  centralBilling: boolean;
}

export interface Plan {
  id: PlanId;
  name: string;
  /** Monthly price in GBP. `null` = custom/contact sales. */
  priceMonthly: number | null;
  /** Yearly price per month in GBP (the discounted rate). */
  priceYearlyPerMonth: number | null;
  /** Full yearly price in GBP, as billed. `null` = custom/contact sales. */
  priceYearly: number | null;
  /** Who buys this plan — drives which column it appears in on the admin page. */
  audience: "teacher" | "school";
  /** One-line description shown on the pricing page. */
  description: string;
  /** For per-seat plans, the unit the price is quoted in. */
  interval: "month" | "seat/month";
  /** Withdrawn from sale. Kept here so existing accounts still resolve limits
   *  and so admin revenue figures reconcile, but never offered for purchase. */
  retired?: boolean;
  /** Not yet shippable — hidden from the public pricing page and flagged as
   *  work-in-progress in the admin console. */
  hidden?: boolean;
  limits: PlanLimits;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free Plan",
    priceMonthly: 0,
    priceYearlyPerMonth: 0,
    priceYearly: 0,
    audience: "teacher",
    description: "1 a day, 5 a month, watermarked",
    interval: "month",
    limits: {
      dailyGenerations: 1,
      monthlyGenerations: 5,
      aiImageSlideshows: 0,
      watermark: true,
      exportFormats: ["pdf"],
      curriculumAlignment: "limited",
      editableOutputs: false,
      saveLibrary: false,
      prioritySupport: false,
      multiUser: false,
      sharedLibrary: false,
      adminDashboard: false,
      usageAnalytics: false,
      schoolBranding: false,
      centralBilling: false,
    },
  },
  pro: {
    id: "pro",
    name: "Pro Teacher",
    // £7.99/mo, £79.00/yr — matches the Stripe prices configured for
    // STRIPE_PRICE_PRO_MONTHLY / STRIPE_PRICE_PRO_YEARLY.
    priceMonthly: 7.99,
    priceYearlyPerMonth: 6.58,
    priceYearly: 79.0,
    audience: "teacher",
    description: "Everything, fair use. For one teacher.",
    interval: "month",
    limits: {
      dailyGenerations: null,
      monthlyGenerations: null,
      aiImageSlideshows: 12,
      watermark: false,
      exportFormats: ["pdf", "docx", "pptx"],
      curriculumAlignment: "full",
      editableOutputs: true,
      saveLibrary: true,
      prioritySupport: true,
      multiUser: false,
      sharedLibrary: false,
      adminDashboard: false,
      usageAnalytics: false,
      schoolBranding: false,
      centralBilling: false,
    },
  },
  max: {
    id: "max",
    name: "Max Teacher",
    // WITHDRAWN FROM SALE. There is no Stripe price for Max any more and no
    // checkout path can reach it. The entry survives so that an account still
    // holding plan='max' resolves real limits instead of falling back to Free,
    // and so admin MRR keeps counting its £14.99. Same treatment in the
    // plan_config table (status='retired').
    retired: true,
    priceMonthly: 14.99,
    priceYearlyPerMonth: 12.42,
    priceYearly: 149.0,
    audience: "teacher",
    description: "Adds leadership, inspection and CPD tools",
    interval: "month",
    limits: {
      dailyGenerations: null,
      monthlyGenerations: null,
      aiImageSlideshows: 25,
      watermark: false,
      exportFormats: ["pdf", "docx", "pptx"],
      curriculumAlignment: "full",
      editableOutputs: true,
      saveLibrary: true,
      prioritySupport: true,
      multiUser: false,
      sharedLibrary: false,
      adminDashboard: false,
      usageAnalytics: false,
      schoolBranding: false,
      centralBilling: false,
    },
  },
  school: {
    id: "school",
    name: "School Plan",
    // Stripe has a real per-seat price (£4.25/mo, £51.00/yr — see
    // STRIPE_PRICE_SCHOOL_MONTHLY/_YEARLY), but this field is a single flat
    // price and there's no seat-count model on profiles yet to multiply it
    // by. Leaving it null keeps it "custom pricing" rather than silently
    // treating every school teacher as £4.25/mo revenue regardless of their
    // school's actual seat count.
    priceMonthly: null,
    priceYearlyPerMonth: null,
    priceYearly: null,
    audience: "school",
    description: "Per seat, banded, invoiced annually",
    interval: "seat/month",
    // WORK IN PROGRESS — seats, pooled allowances and central billing are not
    // implemented, so this is hidden from /pricing and flagged in the admin
    // console rather than being sold.
    hidden: true,
    limits: {
      // Per seat. Both pools are shared across the school — a 30-seat school
      // has 9,000 resources and 90 AI slideshows a month to distribute as it
      // likes. `monthlyGenerations` stays null because the cap is enforced at
      // the school pool level, not per teacher.
      dailyGenerations: null,
      monthlyGenerations: null,
      aiImageSlideshows: 3,
      watermark: false,
      exportFormats: ["pdf", "docx", "pptx"],
      curriculumAlignment: "full",
      editableOutputs: true,
      saveLibrary: true,
      prioritySupport: true,
      multiUser: true,
      sharedLibrary: true,
      adminDashboard: true,
      usageAnalytics: true,
      schoolBranding: true,
      centralBilling: true,
    },
  },
};

export const DEFAULT_PLAN: PlanId = "free";

/**
 * The plans an admin may actually put someone on, in display order.
 *
 * Excludes `max` (withdrawn from sale — no Stripe price exists) and `school`
 * (not built — no seats, no pooled allowances, no central billing). Offering
 * either in a dropdown would let an admin move a teacher onto a plan that
 * cannot be billed and, for `school`, does not function.
 *
 * Both plans stay fully defined in PLANS: an account already holding one still
 * resolves real limits and still renders the right badge. This is a
 * presentation filter, not a removal.
 */
export const SELECTABLE_PLANS: Plan[] = Object.values(PLANS).filter(
  (p) => !p.retired && !p.hidden,
);

// ── AI spend ceiling ─────────────────────────────────────────────────────────
/**
 * Monthly ceiling on MEASURED provider AI spend, in pence. `null` = no ceiling.
 *
 * This is a margin guard, not a unit allowance. Because it is denominated in
 * real cost (token_usage + asset_cost, summed by the monthly_ai_spend RPC),
 * every route that records cost counts against it automatically — including
 * /api/modify refinements and slideshow sub-assets, which are deliberately not
 * counted as "generations". There is no path list to keep in sync.
 *
 * Free is `null` because it is gated by generation COUNT instead; a free user
 * can never spend enough to matter. Pro is £1.50 against £7.99 of revenue.
 */
export const AI_SPEND_CEILING_PENCE: Record<PlanId, number | null> = {
  free: null,
  pro: 150,
  // Withdrawn from sale, but anyone still on it gets Pro's guard rather than
  // an unmetered account.
  max: 150,
  // Pooled at the school level; not modelled yet.
  school: null,
};

/** One top-up purchase, in pence. Repeatable; expires at month end. */
export const TOPUP_PENCE = 150;

/**
 * The monthly resource allowance to display for a plan. Distinct from
 * `monthlyGenerations`, which is the *enforced* cap — unlimited plans have no
 * cap to enforce but the admin console still needs a denominator for the
 * resource meter. `null` means genuinely uncapped with nothing to meter against.
 *
 * Free is 5/month (alongside 1/day). The earlier "10 resources" figure from the
 * admin console spec is gone: launch pricing settled on 1 a day, 5 a month, and
 * plan_config now stores the same.
 */
export function displayResourceAllowance(plan: PlanId): number | null {
  return PLANS[plan].limits.monthlyGenerations;
}

/** Coerce an arbitrary string (e.g. a DB value) into a valid PlanId. */
export function asPlanId(value: string | null | undefined): PlanId {
  return value === "pro" || value === "max" || value === "school" ? value : DEFAULT_PLAN;
}

/** Read the limits object for a plan. */
export function limitsFor(plan: PlanId): PlanLimits {
  return PLANS[plan].limits;
}

// ── Gate helpers ──────────────────────────────────────────────────────────────
// Boolean entitlements (everything in PlanLimits except the numeric/array ones).
type BooleanGate = {
  [K in keyof PlanLimits]: PlanLimits[K] extends boolean ? K : never;
}[keyof PlanLimits];

/** True if the plan has the given boolean entitlement. */
export function can(plan: PlanId, gate: BooleanGate): boolean {
  return PLANS[plan].limits[gate];
}

/** True if the plan may export to the given format. */
export function canExport(plan: PlanId, format: ExportFormat): boolean {
  return PLANS[plan].limits.exportFormats.includes(format);
}

/** Which cap stopped a generation. `null` when it was allowed. */
export type GenerationBlockReason = "free_daily" | "free_monthly" | null;

export interface GenerationGate {
  /** Whether the user may run another generation right now. */
  allowed: boolean;
  /** Which cap blocked it, if any. */
  reason: GenerationBlockReason;
  /** Generations used today (UTC). */
  usedToday: number;
  /** Generations used this month. */
  used: number;
  /** The plan's daily cap, or null for none. */
  dailyLimit: number | null;
  /** The plan's monthly cap, or null for unlimited. */
  limit: number | null;
  /** Generations remaining this month, or null for unlimited. */
  remaining: number | null;
}

/**
 * Evaluate the generation caps for a plan given current usage. Both caps are
 * global across all tools.
 *
 * The MONTHLY cap outranks the daily one: a free user who has used all 5 this
 * month is blocked even on a fresh day. Checking it first means the reason we
 * report is the one that actually needs solving (wait for the 1st, not until
 * midnight).
 */
export function generationGate(
  plan: PlanId,
  usedThisMonth: number,
  usedToday = 0,
): GenerationGate {
  const { dailyGenerations: dailyLimit, monthlyGenerations: limit } = PLANS[plan].limits;
  const remaining = limit === null ? null : Math.max(0, limit - usedThisMonth);

  const base = { usedToday, used: usedThisMonth, dailyLimit, limit, remaining };

  if (limit !== null && usedThisMonth >= limit) {
    return { ...base, allowed: false, reason: "free_monthly" };
  }
  if (dailyLimit !== null && usedToday >= dailyLimit) {
    return { ...base, allowed: false, reason: "free_daily" };
  }
  return { ...base, allowed: true, reason: null };
}
