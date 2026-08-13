// ── Editable site copy ───────────────────────────────────────────────────────
// The read half of /admin/copy. The admin panel has always been able to edit,
// draft, publish and roll back copy blocks; nothing read them, so publishing
// changed a row in the database and nothing else. This is what makes the page
// mean something.
//
// Two rules shape everything here:
//
//   1. Read `public_copy`, never `copy_blocks`. The view filters to
//      `live and value is not null`, which is what keeps an unpublished draft
//      off the marketing site. RLS is row-level, not column-level, so the view
//      is the mechanism.
//
//   2. A missing value is never a blank page. Every key has a code default, and
//      an unpublished key, an empty string or a database that is down all fall
//      through to it. Copy is decoration; it must not be able to take the
//      landing page down.
import "server-only";
import { unstable_cache } from "next/cache";
import { supabaseAdmin } from "./supabase-admin";

/** Cache tag for the published-copy read. /api/admin/copy/revalidate busts it
 *  when an admin publishes, so an edit is live in seconds rather than waiting
 *  out the TTL below. */
export const COPY_TAG = "public-copy";

/**
 * Every key a surface actually renders.
 *
 * This union is deliberately the same nine keys that exist in `copy_blocks`
 * after 20260813000100_copy_seed_and_prune.sql. Keeping the two in step is the
 * whole point: a key here with no row is harmless (DEFAULTS covers it), and a
 * row with no key here is a block an admin can edit that changes nothing —
 * which is exactly the problem that migration removed.
 */
export type CopyKey =
  | "home.hero.eyebrow"
  | "home.hero.h1"
  | "home.hero.sub"
  | "home.hero.cta"
  | "home.hero.reassure"
  | "pricing.headline"
  | "pricing.sub"
  | "dash.empty.title"
  | "dash.empty.body";

export type CopyMap = Record<CopyKey, string>;

/**
 * What renders when the database has nothing to say: a key that was never
 * published, a fresh environment before the seed migration runs, or Supabase
 * being unreachable.
 *
 * These match the seeded values, and they are the strings that were previously
 * hardcoded in the components — so the fallback is not a degraded page, it is
 * the page exactly as it shipped before copy became editable.
 *
 * Note the absence of markup. `home.hero.h1` used to carry a literal <br /> to
 * balance its two lines; that break is now CSS (`text-wrap: balance`) so the
 * string stays plain prose an admin can edit without writing HTML.
 */
export const DEFAULTS: CopyMap = {
  "home.hero.eyebrow": "AI-Powered Lesson Creation",
  "home.hero.h1": "Create personalised lessons in minutes, not hours.",
  "home.hero.sub":
    "Jooma helps teachers generate personalised, curriculum-aligned lessons in minutes — reducing planning time while improving classroom engagement.",
  "home.hero.cta": "Get Started",
  "home.hero.reassure": "No card required · 5 free resources every month",
  "pricing.headline": "Simple pricing for smarter lesson planning",
  "pricing.sub":
    "Choose a plan that saves you time, reduces workload, and helps you create better lessons in seconds.",
  "dash.empty.title": "Nothing here yet",
  "dash.empty.body": "Pick a tool and make your first resource — it takes about a minute.",
};

/**
 * The cached read.
 *
 * Service-role client rather than the request-scoped one: `unstable_cache` must
 * not read cookies, and a cached value keyed to one visitor's session would be
 * wrong for the next. `public_copy` is granted to anon anyway, so this borrows
 * no privilege it needs — it just avoids needing a request context.
 *
 * The 300s ceiling is a backstop, not the primary mechanism. Publishing pings
 * the revalidate route and the tag busts immediately; the TTL only matters for
 * a change made outside a Next request, such as SQL run by hand.
 */
const loadPublished = unstable_cache(
  async (): Promise<Record<string, string>> => {
    const { data, error } = await supabaseAdmin.from("public_copy").select("key, value");
    if (error || !data) return {};
    return Object.fromEntries(
      data
        .filter((r): r is { key: string; value: string } => typeof r.value === "string")
        .map((r) => [r.key, r.value]),
    );
  },
  ["public-copy-v1"],
  { tags: [COPY_TAG], revalidate: 300 },
);

/**
 * Published copy, with a code default behind every key.
 *
 * Server components only — this module is `server-only`. Client components take
 * the strings they need as props; see app/pricing/page.tsx for the pattern.
 */
export async function getCopy(): Promise<CopyMap> {
  let published: Record<string, string> = {};
  try {
    published = await loadPublished();
  } catch {
    // Swallowed on purpose. A copy read that throws must not take out the
    // landing page — the defaults below are a complete, correct page.
  }

  const out: CopyMap = { ...DEFAULTS };
  for (const key of Object.keys(DEFAULTS) as CopyKey[]) {
    const value = published[key];
    // Whitespace-only counts as absent: an admin who clears a field and
    // publishes should get the default back, not an invisible heading.
    if (typeof value === "string" && value.trim().length > 0) out[key] = value;
  }
  return out;
}
