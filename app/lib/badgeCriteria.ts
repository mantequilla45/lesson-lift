import { ALL_BADGES, isPending, EARNABLE_TOTAL } from "@/app/lib/badges";
import { minutesSavedFor, v2ToolForSlug, V2_TOOLS, type V2CategoryId } from "@/app/lib/tools";
import type { ToolRun } from "@/app/lib/toolRuns";

/*
 * What earns a badge.
 *
 * Kept out of badges.ts so the catalogue stays a pure data file: this imports
 * the tool metadata and the run shape, and that dependency should not be forced
 * on anything that only wants to render a medallion.
 *
 * Everything here is computed from history rather than recorded at the moment
 * it happens. That is the important design decision and it buys two things.
 * A badge added later awards retroactively to everyone who already qualifies,
 * with no backfill. And a badge cannot be lost to a missed event: there is no
 * event, only the rows, and the rows do not go anywhere.
 *
 * Evaluation is cheap enough to run on every page load. It is a handful of
 * passes over the runs already in memory for the metrics row.
 */

// ── Days, in the timezone a British teacher actually lives in ────────────────

/*
 * Bucketing a timestamp to a day is the whole streak, so it has to be right.
 *
 * created_at is timestamptz. Bucketing in UTC breaks British Summer Time: a
 * resource made at 00:30 on a Tuesday in June is 23:30 Monday UTC, so a teacher
 * who worked late on Monday and again on Tuesday would look like they only
 * worked Monday, and a streak they earned would quietly not count. Bucketing in
 * the browser's zone is wrong for the same reason in the other direction for
 * anyone travelling.
 *
 * en-CA gives YYYY-MM-DD, which sorts and compares as a string.
 */
const LONDON_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function londonDayKey(date: Date): string {
  return LONDON_DAY.format(date);
}

const LONDON_PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  weekday: "short",
  hour: "2-digit",
  hour12: false,
});

/** Weekday index and hour in London, for the weekend and early-bird rules. */
function londonWhen(date: Date): { weekend: boolean; hour: number } {
  const parts = LONDON_PARTS.formatToParts(date);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "12");
  return { weekend: weekday === "Sat" || weekday === "Sun", hour };
}

/** A YYYY-MM-DD key shifted by n days, staying a calendar day rather than a
 *  timestamp so the hour never drifts across a DST boundary. */
function shiftKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const at = new Date(Date.UTC(y!, m! - 1, d!));
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
}

/** Saturday or Sunday, from a YYYY-MM-DD key. */
function isWeekendKey(key: string): boolean {
  const [y, m, d] = key.split("-").map(Number);
  const day = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
  return day === 0 || day === 6;
}

/*
 * The streak rule.
 *
 * A day counts when the teacher saved at least one resource on it. Walking
 * backwards from today: weekends are SKIPPED (they neither break nor extend a
 * streak), and one missed weekday is forgiven before the streak ends.
 *
 * Why not simply "consecutive calendar days", which is what "day streak" says:
 * UK teachers do not work Saturdays. Under a literal rule every teacher's
 * streak would cap at five and reset every Monday, so the number would be
 * permanently between one and five and mean nothing, and the only way to reach
 * the twelve the mockup shows would be to work through the weekend. A product
 * whose entire pitch is giving teachers their evenings back should not have its
 * headline metric quietly reward not having a weekend.
 *
 * The one weekday of grace covers an INSET day, a sick day, a school trip, a
 * day of back-to-back cover. Without it a genuine eight week habit is wiped out
 * by one bout of flu, which makes the number feel adversarial rather than
 * encouraging.
 *
 * Holidays are deliberately NOT special cased. Term dates vary by school, trust
 * and nation and there is no source for them here. A long weekend survives on
 * the grace; a two week half term ends the streak, and that is honest. A
 * "streak" that survived six weeks of summer would be a lie.
 *
 * Weekend work still counts everywhere else: the run is in the history for
 * `monday-morning` to see. The two rules do not fight.
 *
 * `now` is passed in rather than read here. Reading the clock inside a
 * derivation makes it impure and gives a different answer on every render, and
 * on this screen it is also a hydration mismatch waiting to happen. TodayView
 * holds the mount-time clock for exactly this reason.
 */
export function streakFrom(activeDays: Set<string>, now: Date): number {
  if (activeDays.size === 0) return 0;

  const today = londonDayKey(now);
  let streak = 0;
  let graceUsed = false;
  let cursor = today;

  // A teacher who has not made anything yet today has not broken anything: the
  // day is not over. Start from yesterday unless today is already active.
  if (!activeDays.has(cursor)) cursor = shiftKey(cursor, -1);

  // Bounded rather than while(true): the ceiling is a school career, and an
  // unbounded backwards walk over a corrupt key would hang the render.
  for (let i = 0; i < 4000; i++) {
    if (isWeekendKey(cursor)) {
      cursor = shiftKey(cursor, -1);
      continue;
    }
    if (activeDays.has(cursor)) {
      streak++;
      cursor = shiftKey(cursor, -1);
      continue;
    }
    if (!graceUsed) {
      graceUsed = true;
      cursor = shiftKey(cursor, -1);
      continue;
    }
    break;
  }

  return streak;
}

/** The best run of weekdays ever, under the same rule. Powers streak-7 and up,
 *  which should stay earned rather than being revoked when a streak lapses. */
export function longestStreakFrom(activeDays: Set<string>): number {
  if (activeDays.size === 0) return 0;
  let best = 0;
  for (const day of activeDays) {
    // Only start a walk at a day that begins a run, so this is linear in
    // practice rather than quadratic.
    const previousWeekday = (() => {
      let k = shiftKey(day, -1);
      for (let i = 0; i < 7 && isWeekendKey(k); i++) k = shiftKey(k, -1);
      return k;
    })();
    if (activeDays.has(previousWeekday)) continue;

    let run = 0;
    let cursor = day;
    let graceUsed = false;
    for (let i = 0; i < 4000; i++) {
      if (isWeekendKey(cursor)) {
        cursor = shiftKey(cursor, 1);
        continue;
      }
      if (activeDays.has(cursor)) {
        run++;
        cursor = shiftKey(cursor, 1);
        continue;
      }
      if (!graceUsed) {
        graceUsed = true;
        cursor = shiftKey(cursor, 1);
        continue;
      }
      break;
    }
    if (run > best) best = run;
  }
  return best;
}

// ── Reading the teacher's own words out of a run ─────────────────────────────

/*
 * Every tool POSTs its own form shape, so there is no single `subject` field to
 * read. These scan for the keys that mean the same thing across tools, and are
 * deliberately forgiving: a badge that fails to award is a disappointment, but
 * one that awards wrongly is a lie about what the teacher did, so both of these
 * only ever return something they actually found.
 */
const SUBJECT_KEYS = ["subject", "subjectArea", "curriculumSubject"];
const YEAR_KEYS = ["yearGroup", "year", "yearGroups", "ageRange", "keyStage"];

function readKey(input: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === "string" && value.trim()) return value.trim().toLowerCase();
  }
  return null;
}

// ── The stats snapshot ───────────────────────────────────────────────────────

export interface BadgeStats {
  runCount: number;
  distinctTools: Set<string>;
  distinctCategories: Set<V2CategoryId>;
  distinctSubjects: Set<string>;
  distinctYearGroups: Set<string>;
  minutesSaved: number;
  activeDays: Set<string>;
  currentStreak: number;
  longestStreak: number;
  /** Any resource made on a Saturday or Sunday. */
  weekendPlanning: boolean;
  /** Any resource made before eight in the morning, London time. */
  earlyMorning: boolean;
  /** Distinct London days with at least one run, as a count. */
  activeDayCount: number;
  /** Whole weeks between the first run and the most recent one. */
  weeksSinceFirstRun: number;
  accountAgeDays: number | null;
  profileComplete: boolean | null;
  assistantMessageCount: number | null;
  /** Library folders the teacher has made. Null before the table exists. */
  folderCount: number | null;
  /** Resources shared with colleagues. Null before the shares table exists,
   *  which is what keeps the six share badges quiet rather than saying you have
   *  shared nothing. */
  sharesSent: number | null;
  /** How many different colleagues have been shared with. */
  shareRecipients: number | null;
  /** Shares from colleagues this teacher has saved into their own library. */
  sharesSaved: number | null;
  /** How many badges are already held. Powers the two "collect them all" ones. */
  earnedCount: number;
}

export function buildStats(input: {
  runs: ToolRun[];
  now: Date;
  accountCreatedAt: string | null;
  profileComplete: boolean | null;
  assistantMessageCount: number | null;
  folderCount: number | null;
  sharesSent: number | null;
  shareRecipients: number | null;
  sharesSaved: number | null;
  earnedCount: number;
}): BadgeStats {
  const { runs, now } = input;

  const distinctTools = new Set<string>();
  const distinctCategories = new Set<V2CategoryId>();
  const distinctSubjects = new Set<string>();
  const distinctYearGroups = new Set<string>();
  const activeDays = new Set<string>();
  let minutesSaved = 0;
  let weekendPlanning = false;
  let earlyMorning = false;
  let earliest: number | null = null;
  let latest: number | null = null;

  for (const run of runs) {
    distinctTools.add(run.tool_slug);
    const tool = v2ToolForSlug(run.tool_slug);
    if (tool) distinctCategories.add(tool.category);
    minutesSaved += minutesSavedFor(run.tool_slug);

    const subject = readKey(run.input, SUBJECT_KEYS);
    if (subject) distinctSubjects.add(subject);
    const year = readKey(run.input, YEAR_KEYS);
    if (year) distinctYearGroups.add(year);

    const at = new Date(run.created_at);
    const ms = at.getTime();
    if (Number.isNaN(ms)) continue;
    activeDays.add(londonDayKey(at));
    const { weekend, hour } = londonWhen(at);
    if (weekend) weekendPlanning = true;
    if (hour < 8) earlyMorning = true;
    if (earliest === null || ms < earliest) earliest = ms;
    if (latest === null || ms > latest) latest = ms;
  }

  const DAY_MS = 24 * 60 * 60 * 1000;

  return {
    runCount: runs.length,
    distinctTools,
    distinctCategories,
    distinctSubjects,
    distinctYearGroups,
    minutesSaved,
    activeDays,
    currentStreak: streakFrom(activeDays, now),
    longestStreak: longestStreakFrom(activeDays),
    weekendPlanning,
    earlyMorning,
    activeDayCount: activeDays.size,
    weeksSinceFirstRun:
      earliest !== null && latest !== null
        ? Math.floor((latest - earliest) / (7 * DAY_MS))
        : 0,
    accountAgeDays: input.accountCreatedAt
      ? Math.floor((now.getTime() - new Date(input.accountCreatedAt).getTime()) / DAY_MS)
      : null,
    profileComplete: input.profileComplete,
    assistantMessageCount: input.assistantMessageCount,
    folderCount: input.folderCount,
    sharesSent: input.sharesSent,
    shareRecipients: input.shareRecipients,
    sharesSaved: input.sharesSaved,
    earnedCount: input.earnedCount,
  };
}

// ── Criteria ─────────────────────────────────────────────────────────────────

/*
 * Three valued, and the third value is the point.
 *
 *   true  — earned
 *   false — not yet, but it is a thing you can do
 *   null  — Jooma cannot tell, because the feature does not exist
 *
 * `false` and `null` both render as a locked medallion, but they are different
 * facts and conflating them is how you ship a badge that can never be earned
 * while looking earnable. Every `pending` badge in the catalogue returns null
 * here, and `evaluate` never puts a null in the claim.
 */
type Criterion = (s: BadgeStats) => boolean | null;

/** Used a tool from this slug at least once. */
const used = (slug: string): Criterion => (s) => s.distinctTools.has(slug);

/** Used any of these tools. Several badges name a job, not one tool. */
const usedAny =
  (...slugs: string[]): Criterion =>
  (s) =>
    slugs.some((slug) => s.distinctTools.has(slug));

/** The feature this measures does not exist. */
const unknowable: Criterion = () => null;

export const CRITERIA: Record<string, Criterion> = {
  // 1 — first steps
  "first-resource": (s) => s.runCount >= 1,
  "first-slides": usedAny("slideshow", "cpd-slideshow"),
  "first-worksheet": used("worksheet-generator"),
  "first-plan": used("lesson-planner"),
  // Refining shows up as a second run of the same tool on the same day, which
  // is what "edited after generating" means in the data we keep.
  "first-edit": (s) => s.runCount > s.distinctTools.size,
  // Every run is saved to the library; there is no separate save action.
  "first-save": (s) => s.runCount >= 1,
  "first-mo": (s) => (s.assistantMessageCount === null ? null : s.assistantMessageCount >= 1),
  "first-export": unknowable,
  "profile-complete": (s) => s.profileComplete,
  "first-week": (s) => (s.accountAgeDays === null ? null : s.accountAgeDays <= 7 && s.runCount >= 1),

  // 2 — breadth
  "three-tools": (s) => s.distinctTools.size >= 3,
  "five-tools": (s) => s.distinctTools.size >= 5,
  "two-subjects": (s) => s.distinctSubjects.size >= 2,
  "two-year-groups": (s) => s.distinctYearGroups.size >= 2,
  "assessment-first": (s) => s.distinctCategories.has("assessment"),
  "send-first": (s) => s.distinctCategories.has("send"),
  "comms-first": used("letter-writer"),
  "reading-first": used("comprehension-generator"),
  "quiz-first": used("quiz-generator"),
  "cover-first": used("cover-lesson"),

  // 3 — rhythm
  "ten-resources": (s) => s.runCount >= 10,
  "streak-3": (s) => s.longestStreak >= 3,
  "streak-7": (s) => s.longestStreak >= 7,
  "monday-morning": (s) => s.weekendPlanning,
  "early-bird": (s) => s.earlyMorning,
  // Real folders now, so this is a real count rather than a stand-in for
  // "five different tools". Stays null while folderCount is null, which is what
  // an environment without the folders table looks like.
  "folder-five": (s) => (s.folderCount === null ? null : s.folderCount >= 5),
  "refined": (s) => s.runCount >= s.distinctTools.size + 3,
  "reused": unknowable,
  "differentiated": used("worksheet-generator"),
  "ten-hours": (s) => s.minutesSaved >= 600,

  // 4 — craft
  "twenty-five": (s) => s.runCount >= 25,
  "all-categories": (s) => s.distinctCategories.size >= 7,
  "long-deck": used("slideshow"),
  "reading-ages": (s) => s.distinctTools.has("comprehension-generator") && s.runCount >= 3,
  "knowledge-organiser": used("topic-overview"),
  "modelled": used("model-text-generator"),
  "retrieval": used("quiz-generator"),
  "homework-set": unknowable,
  "marking-saved": usedAny("model-answer-generator", "report-writer"),
  "twenty-hours": (s) => s.minutesSaved >= 1200,

  // 5 — depth
  "fifty-made": (s) => s.runCount >= 50,
  "streak-30": (s) => s.longestStreak >= 30,
  "whole-unit": used("medium-term-planner"),
  "medium-term": used("medium-term-planner"),
  "eyfs": usedAny("eyfs-planner", "eyfs-action-plan"),
  "phonics": used("phonics-support"),
  "intervention": used("targeted-intervention"),
  "one-page": used("one-page-profile"),
  "behaviour-plan": used("behaviour-support-plan"),
  "fifty-hours": (s) => s.minutesSaved >= 3000,

  // 6 — sharing. The share ones are live; the invite ones still are not.
  //
  // An invite badge is worded "N colleagues JOINED because of you", which needs
  // an accepted invite, and that acceptance is the same path the referral credit
  // bonus will run through. That bonus is an open product decision, so these
  // wait for it rather than shipping a reward for something whose value is
  // still being decided.
  "first-share": (s) => (s.sharesSent === null ? null : s.sharesSent >= 1),
  "five-shares": (s) => (s.sharesSent === null ? null : s.sharesSent >= 5),
  "first-invite": unknowable,
  "three-invites": unknowable,
  "received": (s) => (s.sharesSaved === null ? null : s.sharesSaved >= 1),
  "department": (s) => (s.shareRecipients === null ? null : s.shareRecipients >= 5),
  "newsletter": used("newsletter-writer"),
  "assembly": used("assembly-planner"),
  "parents": (s) => s.distinctTools.has("letter-writer") && s.runCount >= 5,
  "cpd": used("cpd-slideshow"),

  // 7 — leadership
  "hundred": (s) => s.runCount >= 100,
  "policy": used("policy-generator"),
  "sip": used("school-improvement-plan"),
  "learning-walk": used("learning-walk-report"),
  "observation": used("lesson-observation-report"),
  "performance": used("performance-management"),
  "meeting": used("meeting-planner"),
  "inspection": used("inspection-prep"),
  "pupil-premium": used("pupil-premium-planner"),
  "risk-assessment": used("risk-assessment"),

  // 8 — mastery
  "all-tools": (s) => s.distinctTools.size >= V2_TOOLS.length,
  "streak-100": (s) => s.longestStreak >= 100,
  "term-planned": used("medium-term-planner"),
  "hundred-hours": (s) => s.minutesSaved >= 6000,
  "every-year": (s) => s.distinctYearGroups.size >= 5,
  "ect-support": used("ect-report-writer"),
  "exam-ready": usedAny("exam-question-generator", "model-answer-generator"),
  "reports-done": (s) => s.distinctTools.has("report-writer") && s.runCount >= 20,
  "smart-targets": used("smart-targets"),
  "sensory": used("sensory-activities"),

  // 9 — consistency
  "two-hundred": (s) => s.runCount >= 200,
  "full-year": (s) => s.weeksSinceFirstRun >= 39,
  "every-half-term": unknowable,
  "two-hundred-hours": (s) => s.minutesSaved >= 12000,
  "library-fifty": (s) => s.runCount >= 50,
  "organised": unknowable,
  "mo-regular": (s) => (s.assistantMessageCount === null ? null : s.assistantMessageCount >= 50),
  "refined-often": (s) => s.runCount >= s.distinctTools.size + 50,
  "shared-twenty": (s) => (s.sharesSent === null ? null : s.sharesSent >= 20),
  "mentor": unknowable,

  // 10 — the long haul
  "five-hundred": (s) => s.runCount >= 500,
  "two-years": (s) => (s.accountAgeDays === null ? null : s.accountAgeDays >= 730),
  "five-hundred-hours": (s) => s.minutesSaved >= 30000,
  "every-category-deep": (s) => s.distinctCategories.size >= 7 && s.runCount >= 140,
  "whole-school": unknowable,
  "ten-invites": unknowable,
  "hundred-shares": (s) => (s.sharesSent === null ? null : s.sharesSent >= 100),
  "never-missed": (s) => s.weeksSinceFirstRun >= 39 && s.activeDayCount >= 39,
  // The last two are the collection itself. Measured against the earnable total
  // minus these two, or they would require themselves.
  "all-hundred": (s) => s.earnedCount >= EARNABLE_TOTAL - 2,
  "legend": (s) => s.earnedCount >= EARNABLE_TOTAL - 1,
};

/*
 * Every badge must have a criterion, and a criterion must belong to a badge. A
 * badge with neither entry nor flag would be permanently unearnable while
 * looking like an oversight; a criterion for an id that no longer exists is
 * dead code that will never run. Both are caught at import.
 */
{
  for (const badge of ALL_BADGES) {
    if (!(badge.id in CRITERIA)) {
      throw new Error(`Badge has no criterion: ${badge.id}`);
    }
  }
  const ids = new Set(ALL_BADGES.map((b) => b.id));
  for (const id of Object.keys(CRITERIA)) {
    if (!ids.has(id)) throw new Error(`Criterion for an unknown badge: ${id}`);
  }
}

/**
 * Which badges this history has earned.
 *
 * Returns only ids whose criterion answered true. Pending badges are skipped
 * outright rather than trusted to return null, so a criterion written before
 * its feature lands cannot start awarding early by accident.
 */
export function evaluate(stats: BadgeStats): string[] {
  const earned: string[] = [];
  for (const badge of ALL_BADGES) {
    if (isPending(badge.id)) continue;
    if (CRITERIA[badge.id]?.(stats) === true) earned.push(badge.id);
  }
  return earned;
}
