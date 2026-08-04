// ── Plan gates — single source of truth ──────────────────────────────────────
// Every feature limit and entitlement is defined here. The pricing page, the
// usage counters, and the runtime gates all read from this config so a plan
// change in one place propagates everywhere.

export type PlanId = "free" | "pro" | "max" | "school";

export type ExportFormat = "pdf" | "docx" | "pptx";

export interface PlanLimits {
  /** Max AI generations per calendar month. `null` = unlimited. */
  monthlyGenerations: number | null;
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
  /** Monthly price in USD. `null` = custom/contact sales. */
  priceMonthly: number | null;
  /** Yearly price per month in USD (the discounted rate). */
  priceYearlyPerMonth: number | null;
  limits: PlanLimits;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free Plan",
    priceMonthly: 0,
    priceYearlyPerMonth: 0,
    limits: {
      monthlyGenerations: 5,
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
    limits: {
      monthlyGenerations: null,
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
    // £14.99/mo, £149.00/yr — matches STRIPE_PRICE_MAX_MONTHLY / _YEARLY.
    // Same limits as Pro for now; differentiating features (AI-image credits,
    // leadership/CPD tools per the CEO's admin console spec) aren't modelled
    // yet.
    priceMonthly: 14.99,
    priceYearlyPerMonth: 12.42,
    limits: {
      monthlyGenerations: null,
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
    limits: {
      monthlyGenerations: null,
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

export interface GenerationGate {
  /** Whether the user may run another generation right now. */
  allowed: boolean;
  /** Generations used this month. */
  used: number;
  /** The plan's monthly cap, or null for unlimited. */
  limit: number | null;
  /** Generations remaining this month, or null for unlimited. */
  remaining: number | null;
}

/** Evaluate the monthly-generation gate for a plan given the current usage. */
export function generationGate(plan: PlanId, usedThisMonth: number): GenerationGate {
  const limit = PLANS[plan].limits.monthlyGenerations;
  if (limit === null) {
    return { allowed: true, used: usedThisMonth, limit: null, remaining: null };
  }
  return {
    allowed: usedThisMonth < limit,
    used: usedThisMonth,
    limit,
    remaining: Math.max(0, limit - usedThisMonth),
  };
}
