// Runtime model selection — the reader of tool_settings.model.
//
// Each API route used to hardcode its model as a string literal. It now asks
// this module instead, passing that literal as the fallback, so the admin
// console can switch a tool to gpt-5.6 and back without a deploy.
//
// ── WHY A CACHE ──
// This runs on every generation, in the same hot path as the tool-availability
// check and my_generation_gate(). A per-request `select model from
// tool_settings` would add a database round-trip to every AI call for a value
// that changes when an admin is experimenting and never otherwise. Mirrors
// app/lib/tool-availability.ts, including its 60s TTL.
//
// ── FAILS OPEN TO THE ROUTE'S OWN DEFAULT ──
// Every failure mode — cold cache, network error, unknown model string, no row
// for the slug — resolves to the literal the route passed in, which is exactly
// the model it used before this feature existed. A bug here can fail to APPLY
// an admin's model choice; it can never break a working tool or call something
// unpriced. That asymmetry matters far more than the TTL does.
//
// ── PER-INSTANCE, NOT SHARED ──
// In-memory state on Fluid Compute, so two warm instances can disagree for up
// to TTL_MS. Acceptable for a setting whose purpose is "try this model" rather
// than "switch atomically", and the reason the TTL is a minute, not an hour.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import {
  DEFAULT_EFFORT,
  DEFAULT_VERBOSITY,
  isKnownModel,
  isReasoning,
  type ModelId,
  type ReasoningEffort,
  type Verbosity,
} from "@/app/lib/models";

const TTL_MS = 60_000;

interface Row {
  model: string | null;
  effort: string | null;
  verbosity: string | null;
}

let cache: { rows: Map<string, Row>; at: number } | null = null;

/**
 * Escape hatch, matching TOOL_GATING_DISABLED. If model selection ever
 * misbehaves in production, this pins every tool back to its hardcoded default
 * with one environment variable and a redeploy — no code change, no migration,
 * no database access needed under pressure.
 */
function selectionDisabled(): boolean {
  return process.env.TOOL_MODEL_SELECTION_DISABLED === "1";
}

/** What a route needs to make the call. Spread straight into streamChat. */
export interface ResolvedModel {
  model: string;
  /** Undefined for gpt-4o models, which take neither param. */
  reasoning_effort?: ReasoningEffort;
  verbosity?: Verbosity;
}

async function load(supabase?: SupabaseClient): Promise<Map<string, Row>> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.rows;

  // Defaults to the service-role client. The routes that call this have no
  // Supabase client in scope, and tool_settings holds no user data — it is the
  // same config every teacher shares, already world-readable to signed-in users
  // under RLS. Callers that do have a client may pass it to reuse the socket.
  const db = supabase ?? supabaseAdmin;

  try {
    const { data, error } = await db
      .from("tool_settings")
      .select("slug, model, effort, verbosity");

    if (error) throw error;

    const rows = new Map<string, Row>();
    for (const r of (data ?? []) as ({ slug: string } & Row)[]) {
      rows.set(r.slug, { model: r.model, effort: r.effort, verbosity: r.verbosity });
    }
    cache = { rows, at: now };
    return rows;
  } catch (err) {
    // Deliberately do NOT advance `at`, so the next request retries rather than
    // holding a failure for a full TTL.
    console.warn(
      "[tool-model] could not read tool_settings:",
      err instanceof Error ? err.message : err,
    );
    return cache?.rows ?? new Map();
  }
}

/**
 * The model a tool should use right now.
 *
 * `fallback` must be the model the route used before this feature — it is what
 * gets returned whenever the configured value is missing, unreadable or not a
 * model we can price.
 *
 * Spread the result directly into streamChat / createCompletion:
 *
 *     ...(await modelFor("letter-writer", "gpt-4o")),
 *
 * Never throws.
 */
export async function modelFor(
  slug: string,
  fallback: ModelId,
  supabase?: SupabaseClient,
): Promise<ResolvedModel> {
  if (selectionDisabled()) return forModel(fallback);

  const row = (await load(supabase)).get(slug);
  const configured = row?.model;

  // An unknown string means the registry and the database have drifted — most
  // likely a model added to the check constraint but not to models.ts. Falling
  // back keeps the tool working AND keeps cost telemetry priceable, since
  // costUsd() would otherwise silently apply gpt-4o rates to it.
  if (!configured || !isKnownModel(configured)) {
    if (configured) {
      console.warn(`[tool-model] ${slug}: unknown model "${configured}" — using ${fallback}`);
    }
    return forModel(fallback);
  }

  return forModel(configured, row?.effort, row?.verbosity);
}

/** Build the call params for a model, applying reasoning defaults only where
 *  they apply. gpt-4o models get neither param — sending them is a 400. */
function forModel(
  model: ModelId,
  effort?: string | null,
  verbosity?: string | null,
): ResolvedModel {
  if (!isReasoning(model)) return { model };
  return {
    model,
    reasoning_effort: (effort as ReasoningEffort) ?? DEFAULT_EFFORT,
    verbosity: (verbosity as Verbosity) ?? DEFAULT_VERBOSITY,
  };
}
