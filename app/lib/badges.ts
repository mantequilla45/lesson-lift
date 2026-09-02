import type { BadgeTier } from "@/app/components/v2/BadgeMedallion";

/*
 * The badge catalogue: 100 badges across 10 levels, 10 per level.
 *
 * This file is the single source of truth for what a badge IS. What a teacher
 * has actually earned lives in the `user_badges` table, keyed by the ids below;
 * what earns one lives in badgeCriteria.ts. Deliberately no `badges` table: a
 * second copy of these names and descriptions in the database would drift, and
 * the handover says the full 100 is still an open product decision, so every
 * wording change would otherwise become a migration.
 *
 * TWO THINGS THAT MUST STAY IN STEP WITH THIS FILE:
 *
 *   1. `known_badge_ids()` in the badges migration. It repeats these ids so the
 *      claim RPC can reject an id the client invented. A badge added here but
 *      not there silently never awards, with no error to notice.
 *   2. CRITERIA in badgeCriteria.ts, which has an entry per id.
 *
 * The criteria reward the teaching habits worth building, never volume. The
 * handover is explicit about this and it is a real cost decision as well as a
 * design one: a badge for "generate 500 resources" encourages waste and the
 * credits come out of our margin. A badge for trying five different tools is
 * healthy, because a teacher who has found the right tool for a job comes back.
 *
 * Tiers run bronze through amethyst as the levels climb, so the collection
 * visibly warms up as it fills.
 */

export interface Badge {
  id: string;
  name: string;
  /** One sentence, in the second person, describing what it represents. */
  description: string;
  /** Kebab-case Phosphor name, resolved by BadgeMedallion. */
  icon: string;
  /**
   * Set when the feature this badge measures does not exist yet.
   *
   * Ten badges are still pending, across levels 1, 3, 6, 9 and 10. Sharing and
   * colleagues have now shipped, which cleared six of them; what remains needs
   * teacher-to-teacher invites (four badges, waiting on the referral decision)
   * and a handful of smaller unbuilt behaviours like exporting and reopening.
   * Left as ordinary unearned badges they would make level 7 unreachable, since
   * level is driven by how many you have collected: a teacher who did every
   * possible thing would still stall, which is worse than the honest "nothing
   * is earnable yet" state this replaces.
   *
   * So a pending badge renders with a "Soon" chip (the same treatment the
   * sidebar gives Timetable and Colleagues) and is excluded from the level
   * maths. When the feature ships, deleting this flag and writing its criterion
   * awards it retroactively to everyone who already qualifies, because
   * evaluation runs over full history rather than on an event.
   */
  pending?: true;
}

export interface BadgeLevel {
  level: number;
  /** What this level is called on the profile and in the sidebar. */
  title: string;
  tier: BadgeTier;
  badges: Badge[];
}

/** Levels 1-2 bronze, 3-4 silver, 5-6 gold, 7-8 sapphire, 9-10 amethyst. */
function tierForLevel(level: number): BadgeTier {
  if (level <= 2) return "bronze";
  if (level <= 4) return "silver";
  if (level <= 6) return "gold";
  if (level <= 8) return "sapphire";
  return "amethyst";
}

const LEVEL_TITLES = [
  "Finding your feet",
  "Getting the hang of it",
  "Getting into your stride",
  "Building a routine",
  "Well practised",
  "Ahead of the week",
  "Quietly expert",
  "Setting the pace",
  "One to learn from",
  "Staffroom legend",
];

/*
 * Ten themes, one per level, each with ten badges.
 *
 * The names and descriptions are a first pass, not a product decision: the full
 * 100 is still open. They are written out rather than generated so that each
 * one can be replaced individually without touching the shape.
 */
const LEVEL_BADGES: Badge[][] = [
  // 1 — first steps
  [
    { id: "first-resource", name: "First one made", description: "You made your first resource.", icon: "file-text" },
    { id: "first-slides", name: "Deck one", description: "You built your first set of slides.", icon: "presentation-chart" },
    { id: "first-worksheet", name: "Off the press", description: "You made your first worksheet.", icon: "note-pencil" },
    { id: "first-plan", name: "Planned out", description: "You wrote your first lesson plan.", icon: "clipboard-text" },
    { id: "first-edit", name: "Second thoughts", description: "You edited something after generating it.", icon: "pencil-simple" },
    { id: "first-save", name: "Filed away", description: "You saved a resource to your library.", icon: "folder" },
    { id: "first-jo", name: "Said hello", description: "You asked Jo for something.", icon: "chat-teardrop-dots" },
    // Exporting is a browser download. Nothing records that it happened.
    { id: "first-export", name: "Out the door", description: "You exported a resource to use in class.", icon: "download-simple", pending: true },
    { id: "profile-complete", name: "Properly introduced", description: "You finished setting up your profile.", icon: "user-circle" },
    { id: "first-week", name: "One week in", description: "You used Jooma in your first week.", icon: "calendar-check" },
  ],
  // 2 — breadth
  [
    { id: "three-tools", name: "Three ways", description: "You used three different tools.", icon: "squares-four" },
    { id: "five-tools", name: "Five ways", description: "You used five different tools.", icon: "grid-four" },
    { id: "two-subjects", name: "Across subjects", description: "You made resources for two subjects.", icon: "books" },
    // `two-year-groups`, not `two-years`: that id belongs to "Two years in" at
    // level 10, and one row in user_badges would have lit both medallions.
    { id: "two-year-groups", name: "Across year groups", description: "You made resources for two year groups.", icon: "users-three" },
    { id: "assessment-first", name: "Checking in", description: "You made your first assessment.", icon: "check-square" },
    { id: "send-first", name: "Everyone included", description: "You used a Behaviour or SEND tool.", icon: "hand-heart" },
    { id: "comms-first", name: "Word out", description: "You wrote your first letter home.", icon: "envelope-simple" },
    { id: "reading-first", name: "Read all about it", description: "You made a comprehension.", icon: "book-open" },
    { id: "quiz-first", name: "Quizmaster", description: "You made your first quiz.", icon: "question" },
    { id: "cover-first", name: "Safe hands", description: "You made a cover lesson someone else could teach.", icon: "handshake" },
  ],
  // 3 — rhythm
  [
    { id: "ten-resources", name: "Into double figures", description: "You made ten resources.", icon: "stack" },
    { id: "streak-3", name: "Three in a row", description: "You used Jooma three days running.", icon: "fire" },
    { id: "streak-7", name: "A full week", description: "You used Jooma seven days running.", icon: "fire-simple" },
    { id: "monday-morning", name: "Ready for Monday", description: "You planned ahead over a weekend.", icon: "sun-horizon" },
    { id: "early-bird", name: "Before the bell", description: "You made something before eight in the morning.", icon: "alarm" },
    { id: "folder-five", name: "Tidy shelf", description: "You built up five folders of resources.", icon: "folders" },
    { id: "refined", name: "Second draft", description: "You refined a resource rather than starting again.", icon: "arrows-clockwise" },
    // Reopening is a navigation, not a row. Nothing records a read.
    { id: "reused", name: "Worth keeping", description: "You reopened a resource you made earlier.", icon: "arrow-counter-clockwise", pending: true },
    { id: "differentiated", name: "For everyone", description: "You differentiated a resource three ways.", icon: "arrows-out-line-horizontal" },
    { id: "ten-hours", name: "Ten hours back", description: "You saved ten hours of planning time.", icon: "clock" },
  ],
  // 4 — craft
  [
    { id: "twenty-five", name: "Twenty five made", description: "You made twenty five resources.", icon: "stack-simple" },
    { id: "all-categories", name: "Full sweep", description: "You used a tool from every category.", icon: "compass" },
    { id: "long-deck", name: "The full lesson", description: "You built a deck of twelve slides or more.", icon: "presentation" },
    { id: "reading-ages", name: "Pitched right", description: "You made the same text at three reading ages.", icon: "text-aa" },
    { id: "knowledge-organiser", name: "All on one page", description: "You made a knowledge organiser.", icon: "list-checks" },
    { id: "modelled", name: "Show them how", description: "You made a model text or answer.", icon: "star" },
    { id: "retrieval", name: "Bringing it back", description: "You built a retrieval activity.", icon: "brain" },
    // "Set" needs somewhere to set it to. Making one is `/tools/homework`,
    // which `homework-first` would cover; this is the timetable version.
    { id: "homework-set", name: "Set and forget", description: "You set homework from Jooma.", icon: "house-line", pending: true },
    { id: "marking-saved", name: "Marking made lighter", description: "You used Jooma to speed up marking.", icon: "check-fat" },
    { id: "twenty-hours", name: "Twenty hours back", description: "You saved twenty hours of planning time.", icon: "hourglass" },
  ],
  // 5 — depth
  [
    { id: "fifty-made", name: "Fifty made", description: "You made fifty resources.", icon: "trophy" },
    { id: "streak-30", name: "A month running", description: "You used Jooma thirty days in a row.", icon: "flame" },
    { id: "whole-unit", name: "The whole unit", description: "You planned a full unit of work.", icon: "map-trifold" },
    { id: "medium-term", name: "Looking ahead", description: "You built a medium term plan.", icon: "calendar-blank" },
    { id: "eyfs", name: "Earliest years", description: "You planned for the early years.", icon: "baby" },
    { id: "phonics", name: "Sound by sound", description: "You made a phonics resource.", icon: "ear" },
    { id: "intervention", name: "Closing the gap", description: "You planned a targeted intervention.", icon: "target" },
    { id: "one-page", name: "Know the child", description: "You made a one page support profile.", icon: "identification-card" },
    { id: "behaviour-plan", name: "A plan that helps", description: "You built an individual behaviour plan.", icon: "heart" },
    { id: "fifty-hours", name: "Fifty hours back", description: "You saved fifty hours of planning time.", icon: "timer" },
  ],
  // 6 — sharing
  //
  // Sharing is built (see app/lib/colleagues.ts), so the four share badges are
  // live. The invite ones are not: each is worded "N colleagues JOINED because
  // of you", which needs an accepted invite, and acceptance is the same path
  // the referral credit bonus will run through. That bonus is still an open
  // product decision, and a badge that rewards an invite before its value is
  // decided would contradict whatever is settled.
  [
    { id: "first-share", name: "Passed it on", description: "You shared a resource with a colleague.", icon: "share-network" },
    { id: "five-shares", name: "Generous", description: "You shared five resources.", icon: "gift" },
    { id: "first-invite", name: "Brought someone", description: "You invited a colleague to Jooma.", icon: "user-plus", pending: true },
    { id: "three-invites", name: "Word of mouth", description: "Three colleagues joined because of you.", icon: "megaphone", pending: true },
    { id: "received", name: "Borrowed well", description: "You saved something a colleague shared.", icon: "hand-arrow-down" },
    { id: "department", name: "Team effort", description: "You shared with five different colleagues.", icon: "users-four" },
    { id: "newsletter", name: "To the whole school", description: "You wrote a school newsletter.", icon: "newspaper" },
    { id: "assembly", name: "Everyone in the hall", description: "You planned an assembly.", icon: "microphone-stage" },
    { id: "parents", name: "Home and school", description: "You wrote to parents five times.", icon: "envelope-open" },
    { id: "cpd", name: "Teaching the teachers", description: "You built a CPD session.", icon: "chalkboard-teacher" },
  ],
  // 7 — leadership
  [
    { id: "hundred", name: "One hundred", description: "You made a hundred resources.", icon: "confetti" },
    { id: "policy", name: "On the record", description: "You drafted a school policy.", icon: "scroll" },
    { id: "sip", name: "The bigger plan", description: "You wrote a school improvement plan.", icon: "trend-up" },
    { id: "learning-walk", name: "Eyes on practice", description: "You wrote up a learning walk.", icon: "footprints" },
    { id: "observation", name: "Constructive", description: "You wrote a lesson observation report.", icon: "eye" },
    { id: "performance", name: "Targets that mean something", description: "You set performance management targets.", icon: "flag" },
    { id: "meeting", name: "Worth the hour", description: "You planned a meeting with an agenda.", icon: "calendar-plus" },
    { id: "inspection", name: "Ready for the call", description: "You prepared inspection questions.", icon: "shield-check" },
    { id: "pupil-premium", name: "Every pound counted", description: "You planned pupil premium spending.", icon: "coins" },
    { id: "risk-assessment", name: "Thought it through", description: "You wrote a risk assessment.", icon: "warning-circle" },
  ],
  // 8 — mastery
  [
    { id: "all-tools", name: "The whole toolkit", description: "You used every tool at least once.", icon: "toolbox" },
    { id: "streak-100", name: "A hundred days", description: "You used Jooma a hundred days in a row.", icon: "lightning" },
    { id: "term-planned", name: "A term ahead", description: "You planned a full term.", icon: "calendar-dots" },
    { id: "hundred-hours", name: "A hundred hours back", description: "You saved a hundred hours of planning time.", icon: "clock-countdown" },
    { id: "every-year", name: "Every year group", description: "You made resources for every year you teach.", icon: "ladder" },
    { id: "ect-support", name: "Steadying hand", description: "You wrote an ECT report.", icon: "lifebuoy" },
    { id: "exam-ready", name: "Exam ready", description: "You built exam questions and model answers.", icon: "exam" },
    { id: "reports-done", name: "Reports done", description: "You wrote a full set of reports.", icon: "graduation-cap" },
    { id: "smart-targets", name: "Sharp targets", description: "You set SMART targets for a class.", icon: "crosshair" },
    { id: "sensory", name: "Every sense", description: "You planned a sensory activity.", icon: "hand-palm" },
  ],
  // 9 — consistency
  [
    { id: "two-hundred", name: "Two hundred", description: "You made two hundred resources.", icon: "medal" },
    { id: "full-year", name: "A full year", description: "You used Jooma across a whole school year.", icon: "calendar-heart" },
    // Needs term dates, which vary by school and trust and have no source here.
    { id: "every-half-term", name: "Every half term", description: "You planned ahead for six half terms running.", icon: "path", pending: true },
    { id: "two-hundred-hours", name: "Two hundred hours back", description: "You saved two hundred hours.", icon: "hourglass-high" },
    { id: "library-fifty", name: "A proper library", description: "You built a library of fifty resources.", icon: "archive" },
    { id: "organised", name: "Everything in its place", description: "You filed every resource you made.", icon: "sort-ascending", pending: true },
    { id: "jo-regular", name: "On first name terms", description: "You asked Jo fifty times.", icon: "chats-circle" },
    { id: "refined-often", name: "Never settles", description: "You refined fifty resources.", icon: "sliders" },
    { id: "shared-twenty", name: "Twenty shared", description: "You shared twenty resources with colleagues.", icon: "tree-structure" },
    { id: "mentor", name: "Mentor", description: "Five colleagues joined because of you.", icon: "student", pending: true },
  ],
  // 10 — the long haul
  [
    { id: "five-hundred", name: "Five hundred", description: "You made five hundred resources.", icon: "crown-simple" },
    { id: "two-years", name: "Two years in", description: "You have used Jooma for two school years.", icon: "cake" },
    { id: "five-hundred-hours", name: "Five hundred hours back", description: "You saved five hundred hours of planning.", icon: "infinity" },
    { id: "every-category-deep", name: "Deep in every corner", description: "You used every category twenty times.", icon: "globe-hemisphere-west" },
    { id: "whole-school", name: "Whole school", description: "Your resources reached every year group.", icon: "buildings", pending: true },
    { id: "ten-invites", name: "Built the staffroom", description: "Ten colleagues joined because of you.", icon: "users-three", pending: true },
    { id: "hundred-shares", name: "A hundred shared", description: "You shared a hundred resources.", icon: "broadcast" },
    { id: "never-missed", name: "Never missed a week", description: "You used Jooma every week for a year.", icon: "seal-check" },
    { id: "all-hundred", name: "The full hundred", description: "You collected every other badge.", icon: "trophy" },
    { id: "legend", name: "Staffroom legend", description: "There is nothing left to earn. Well done.", icon: "star-four" },
  ],
];

export const BADGE_LEVELS: BadgeLevel[] = LEVEL_BADGES.map((badges, i) => ({
  level: i + 1,
  title: LEVEL_TITLES[i]!,
  tier: tierForLevel(i + 1),
  badges,
}));

/** Every badge, level order, flattened. */
export const ALL_BADGES: Badge[] = BADGE_LEVELS.flatMap((l) => l.badges);

/** 100. Derived rather than written down, so the two cannot disagree. */
export const TOTAL_BADGES = ALL_BADGES.length;

/*
 * A duplicate id would make one row in user_badges light two medallions, and
 * `two-years` was exactly that for a while: "Across year groups" at level 2 and
 * "Two years in" at level 10 shared it, so a second year group would have
 * awarded an amethyst level 10 badge. Nothing caught it because everything
 * rendered locked. This throws at import instead.
 */
{
  const seen = new Set<string>();
  for (const badge of ALL_BADGES) {
    if (seen.has(badge.id)) {
      throw new Error(`Duplicate badge id in the catalogue: ${badge.id}`);
    }
    seen.add(badge.id);
  }
}

/** The badges a teacher can actually earn today. See `Badge.pending`. */
export const EARNABLE_BADGES: Badge[] = ALL_BADGES.filter((b) => !b.pending);

export const EARNABLE_TOTAL = EARNABLE_BADGES.length;

const PENDING_IDS = new Set(ALL_BADGES.filter((b) => b.pending).map((b) => b.id));

export function isPending(badgeId: string): boolean {
  return PENDING_IDS.has(badgeId);
}

/**
 * Badges per level for the purpose of climbing.
 *
 * Not ten. Ten is how many are DISPLAYED per level, but eighteen of those
 * measure features that do not exist, and they are not spread evenly: level 6
 * alone has six. Dividing the earnable total by ten instead keeps every level
 * the same distance apart and keeps level 10 reachable, which a per-level count
 * would not.
 */
export const BADGES_PER_LEVEL = Math.ceil(EARNABLE_TOTAL / BADGE_LEVELS.length);

/** The level a teacher with this many badges has reached. 1 to 10. */
export function levelForEarned(earned: number): number {
  const level = Math.floor(earned / BADGES_PER_LEVEL) + 1;
  return Math.min(Math.max(level, 1), BADGE_LEVELS.length);
}

/** What this level is called. Falls back to the first title, never undefined. */
export function levelTitle(level: number): string {
  return BADGE_LEVELS[level - 1]?.title ?? LEVEL_TITLES[0]!;
}

/** How many more badges to climb. 0 at level 10, where there is nowhere left. */
export function badgesToNextLevel(earned: number): number {
  if (levelForEarned(earned) >= BADGE_LEVELS.length) return 0;
  return levelForEarned(earned) * BADGES_PER_LEVEL - earned;
}

/** Progress through the current level, 0 to 1, for the sidebar track. */
export function levelFraction(earned: number): number {
  const level = levelForEarned(earned);
  if (level >= BADGE_LEVELS.length) return 1;
  const into = earned - (level - 1) * BADGES_PER_LEVEL;
  return Math.min(Math.max(into / BADGES_PER_LEVEL, 0), 1);
}

const BY_ID: Record<string, Badge> = Object.fromEntries(
  ALL_BADGES.map((b) => [b.id, b]),
);

/** The catalogue entry for an id, or undefined for one we no longer ship. */
export function badgeById(id: string): Badge | undefined {
  return BY_ID[id];
}

/** The level a badge belongs to, for the tier its medallion is struck in. */
export function levelForBadge(id: string): BadgeLevel | undefined {
  return BADGE_LEVELS.find((l) => l.badges.some((b) => b.id === id));
}
