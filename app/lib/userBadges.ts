import { createClient } from "@/app/lib/auth/client";

/*
 * What this teacher has earned.
 *
 * Mirrors toolRuns.ts: browser Supabase client, RLS scopes every query to the
 * signed-in user, and user_id is never passed because the column defaults to
 * auth.uid().
 *
 * One difference, and it matters. toolRuns throws on error, because tool_runs
 * has existed since May and a failure there is a real fault worth surfacing.
 * These two swallow a missing table or function and return empty instead: the
 * migration is applied by hand, so this code will be running against a database
 * without user_badges for some window, and a throw on the dashboard's mount
 * path would take Today down for every teacher over a feature that is only
 * decoration. Absent data reads as "nothing earned yet", which is exactly what
 * the UI already knows how to render.
 */

export interface UserBadge {
  badge_id: string;
  earned_at: string;
}

/** Postgres 42P01 is undefined_table, 42883 undefined_function. PostgREST also
 *  reports an unknown relation as PGRST205 before it reaches Postgres. */
const MISSING = new Set(["42P01", "42883", "PGRST202", "PGRST205"]);

function isMissingSchema(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code && MISSING.has(error.code)) return true;
  const message = error.message?.toLowerCase() ?? "";
  return message.includes("does not exist") || message.includes("could not find");
}

/**
 * Every badge this teacher holds.
 *
 * Returns null, not [], when the feature is not available: the caller shows the
 * old "Not yet" state for null and a real (possibly empty) collection for an
 * array, and those are different screens.
 */
export async function listUserBadges(): Promise<UserBadge[] | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_badges")
    .select("badge_id, earned_at")
    .order("earned_at", { ascending: false });

  if (error) {
    if (isMissingSchema(error)) return null;
    throw error;
  }
  return (data ?? []) as UserBadge[];
}

/**
 * Offer up the badges this teacher's history has earned.
 *
 * The server decides. It rejects ids that are not in the catalogue and puts a
 * floor under the volume badges (see the claim_badges comment in the migration),
 * then inserts what survives with `on conflict do nothing`. What comes back is
 * only what was NEWLY granted, which is what makes "you have earned something"
 * possible to say once rather than on every visit.
 */
export async function claimBadges(badgeIds: string[]): Promise<string[]> {
  if (badgeIds.length === 0) return [];

  const supabase = createClient();
  const { data, error } = await supabase.rpc("claim_badges", {
    candidate_ids: badgeIds,
  });

  if (error) {
    if (isMissingSchema(error)) return [];
    throw error;
  }

  // setof text comes back as either a bare array or rows, depending on how
  // PostgREST decides to shape it. Normalise rather than trusting one.
  if (!Array.isArray(data)) return [];
  return data
    .map((row: unknown) =>
      typeof row === "string" ? row : ((row as { badge_id?: string })?.badge_id ?? null),
    )
    .filter((id: string | null): id is string => typeof id === "string");
}
