// Runtime tool availability — the single reader of tool_settings.enabled.
//
// Before this file, tool_settings was written only by the admin console and
// read by NOTHING. Turning a tool off in /admin/tools changed a row and nothing
// else: the tool stayed in the teacher grid, the page stayed reachable, and the
// API kept spending money. The edit modal claimed otherwise. This closes that
// loop.
//
// ── WHY A CACHE ──
// The check runs in proxy.ts on every POST to /api/<slug> and every GET of
// /tools/<slug>. A per-request `select enabled from tool_settings` would add a
// database round-trip to the hot path of every generation — on top of the
// my_generation_gate() call already there — for a value that changes maybe
// twice a year.
//
// ── WHY WE CACHE THE *DISABLED* SET, NOT THE WHOLE TABLE ──
// The cached value is the short list of slugs an admin has switched off,
// normally empty. Every failure mode — cold cache, network error, malformed
// row — therefore degrades to "no tool is disabled", which is exactly the
// behaviour before this file existed. A bug here can fail to block a disabled
// tool; it can never block a live one. Getting that asymmetry the right way
// round matters far more than the TTL does.
//
// ── PER-INSTANCE, NOT SHARED ──
// This is in-memory state on Fluid Compute, so two warm instances can hold
// different snapshots for up to TTL_MS. That is acceptable for a switch whose
// purpose is "stop this eventually" rather than "stop this atomically", and it
// is why the TTL is one minute rather than an hour.
import type { SupabaseClient } from "@supabase/supabase-js";

/** How long a snapshot of the disabled set is trusted. Short enough that an
 *  admin toggling a tool sees it take effect while they are still watching. */
const TTL_MS = 60_000;

let cache: { slugs: Set<string>; at: number } | null = null;

/**
 * Escape hatch. If tool gating ever misbehaves in production, setting this
 * turns the whole mechanism into a no-op — one environment variable and a
 * redeploy, with no code change, no migration and no database access needed
 * under pressure.
 */
function gatingDisabled(): boolean {
  return process.env.TOOL_GATING_DISABLED === "1";
}

/**
 * The slugs an admin has switched off.
 *
 * Reads through the caller's own client: tool_settings is readable by any
 * signed-in user under RLS (see 20260805001200), so this needs no service-role
 * key and no new RPC.
 *
 * Never throws and never rejects — on any failure it reports the last known
 * good set, or an empty one.
 */
export async function disabledToolSlugs(
  supabase: SupabaseClient,
): Promise<Set<string>> {
  if (gatingDisabled()) return new Set();

  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.slugs;

  try {
    const { data, error } = await supabase
      .from("tool_settings")
      .select("slug")
      .eq("enabled", false);

    if (error) throw error;

    const slugs = new Set((data ?? []).map((r: { slug: string }) => r.slug));
    cache = { slugs, at: now };
    return slugs;
  } catch (err) {
    // Deliberately do NOT advance `at`, so the next request retries rather than
    // holding a failure for a full TTL.
    console.warn(
      "[tool-availability] could not read tool_settings:",
      err instanceof Error ? err.message : err,
    );
    return cache?.slugs ?? new Set();
  }
}

/** True unless an admin has explicitly switched this tool off. */
export async function isToolEnabled(
  supabase: SupabaseClient,
  slug: string,
): Promise<boolean> {
  return !(await disabledToolSlugs(supabase)).has(slug);
}
