// ── Runtime reader for the settings the app actually obeys ───────────────────
//
// The counterpart to tool-availability.ts, and it follows the same reasoning:
// app_settings changes a few times a year but would otherwise be read on every
// page load, so a short-lived cache keeps it off the hot path.
//
// ── WHY THE FALLBACKS ARE WHAT THEY ARE ──
// Every failure mode here — cold cache, network error, missing row, malformed
// value — degrades to the behaviour the app had before these switches existed:
// signups open, no maintenance page, Google button shown. A bug in this file
// can fail to APPLY a restriction; it can never invent one. Getting that
// asymmetry the right way round matters more than the TTL, because the
// alternative is a transient database blip locking teachers out of a working
// product.
import type { SupabaseClient } from "@supabase/supabase-js";

const TTL_MS = 60_000;

export interface PublicSettings {
  signupsOpen: boolean;
  maintenanceMode: boolean;
  googleSignin: boolean;
}

/** What the app does when it cannot read the table. See the note above. */
const DEFAULTS: PublicSettings = {
  signupsOpen: true,
  maintenanceMode: false,
  googleSignin: true,
};

let cache: { value: PublicSettings; at: number } | null = null;

/**
 * Read the teacher-facing settings.
 *
 * Never throws and never rejects — on any failure it reports the last known
 * good snapshot, or the defaults above.
 */
export async function publicSettings(
  supabase: SupabaseClient,
): Promise<PublicSettings> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.value;

  try {
    const { data, error } = await supabase.rpc("public_settings");
    if (error) throw error;

    const rows = (data ?? []) as { key: string; value: unknown }[];
    const read = (key: string, fallback: boolean) => {
      const row = rows.find((r) => r.key === key);
      return typeof row?.value === "boolean" ? row.value : fallback;
    };

    const value: PublicSettings = {
      signupsOpen: read("signups_open", DEFAULTS.signupsOpen),
      maintenanceMode: read("maintenance_mode", DEFAULTS.maintenanceMode),
      googleSignin: read("google_signin", DEFAULTS.googleSignin),
    };

    cache = { value, at: now };
    return value;
  } catch (err) {
    // Deliberately does not advance `at`, so the next request retries rather
    // than holding a failure for a full TTL.
    console.warn(
      "[settings] could not read app_settings:",
      err instanceof Error ? err.message : err,
    );
    return cache?.value ?? DEFAULTS;
  }
}
