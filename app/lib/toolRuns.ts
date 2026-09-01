import { createClient } from "@/app/lib/auth/client";

// Per-user history of tool generations. Persisted to the `tool_runs` table
// (see supabase/migrations/20260531000000_create_tool_runs.sql). Uses the auth
// browser client so RLS scopes every query to the signed-in user.

export interface ToolRun {
  id: string;
  tool_slug: string;
  title: string | null;
  // `input` is whatever body the tool's form POSTs; shape varies per tool.
  input: Record<string, unknown>;
  output: string;
  created_at: string;
}

/*
 * Called after a run is saved, so badge earning can re-check.
 *
 * A callback rather than a direct import: this module is imported by the badge
 * store (for listRecentRuns), and importing the store back from here would be a
 * cycle. The store registers itself on load instead.
 */
type RunSavedListener = () => void;
const runSavedListeners = new Set<RunSavedListener>();

export function onToolRunSaved(listener: RunSavedListener): () => void {
  runSavedListeners.add(listener);
  return () => {
    runSavedListeners.delete(listener);
  };
}

export async function saveToolRun(run: {
  toolSlug: string;
  title?: string | null;
  input: Record<string, unknown>;
  output: string;
  /** Ties this run to the cost rows the server wrote for the same generation.
   *  Set by callers that pass the same id to their API route; without it, the
   *  admin console falls back to matching cost by timestamp. */
  runId?: string | null;
}): Promise<ToolRun> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tool_runs")
    .insert({
      tool_slug: run.toolSlug,
      title: run.title ?? null,
      input: run.input,
      output: run.output,
      run_id: run.runId ?? null,
    })
    .select()
    .single();
  if (error) throw error;

  // Every tool that saves a run comes through here, which makes this the one
  // place badge earning can hook without touching all five call sites. A
  // listener must never be able to fail the save: the resource is the thing the
  // teacher cares about, a badge is not.
  for (const listener of runSavedListeners) {
    try {
      listener();
    } catch {
      // Deliberately ignored.
    }
  }

  return data as ToolRun;
}

export async function listToolRuns(toolSlug: string): Promise<ToolRun[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tool_runs")
    .select("*")
    .eq("tool_slug", toolSlug)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ToolRun[];
}

// Recent runs across ALL tools — powers the dashboard's "Recently added" table
// and activity stats.
export async function listRecentRuns(limit = 100): Promise<ToolRun[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tool_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ToolRun[];
}

/**
 * One run by id — what `/tools/<slug>?run=<id>` resolves.
 *
 * Returns null when the row is missing or belongs to someone else (RLS makes
 * those indistinguishable, and both mean the same thing here: open the tool
 * empty rather than error). `maybeSingle` rather than `single`, which treats
 * "no row" as an error.
 */
export async function getToolRun(id: string): Promise<ToolRun | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tool_runs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as ToolRun | null) ?? null;
}

export async function deleteToolRun(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("tool_runs").delete().eq("id", id);
  if (error) throw error;
}
