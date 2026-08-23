"use client";

// Applies the two URL parameters a tool page can be launched with to the form's
// existing state.
//
//   ?run=<id>       Reopen a saved run. Every list in the app (Dashboard,
//                   Folders, Analytics) linked to the bare tool page before
//                   this, so clicking a row you had just generated threw the
//                   result away.
//   ?prefill=<b64>  Open with fields filled in from the assistant.
//
// Both reuse what the forms already have: `restore(run)` exists in all 34 forms
// for the history panel, and prefill fields are applied by a small per-form
// setter map. Neither needed a new code path inside the form.
//
// The values arrive as PROPS, read from the server page's `searchParams`, not
// from useSearchParams(). That hook forces a client-side bailout that would
// need a Suspense boundary around every tool form — the same reason app/login
// and app/help both read params on the server instead. See the note at
// app/login/page.tsx:39.
import { useEffect, useMemo, useRef } from "react";
import { getToolRun, type ToolRun } from "@/app/lib/toolRuns";
import { decodePrefill } from "@/app/lib/toolPrefill";
import { assistantToolFor } from "@/app/lib/assistant-tools";

/** Applies one prefilled field to form state. Unknown keys are ignored. */
export type PrefillSetters = Record<string, (value: unknown) => void>;

export interface ToolLaunchParams {
  /** `?run=` — a saved tool_runs id. */
  run?: string;
  /** `?prefill=` — a base64url payload from the assistant. */
  prefill?: string;
}

export function useToolLaunch(opts: {
  params: ToolLaunchParams | undefined;
  /** The form's existing history-restore function. */
  onRestore: (run: ToolRun) => void;
  /** Per-field setters, for the tools the assistant can prefill. */
  prefill?: PrefillSetters;
}) {
  const runId = opts.params?.run;
  const prefillParam = opts.params?.prefill;

  // Whether this page load is a prefill, derived rather than stored: it is a
  // pure function of the URL, so state (and an effect to set it) would be a
  // second source of truth for something already known during render.
  //
  // decodePrefill is cheap — a base64 decode, a JSON.parse and a field walk over
  // a payload capped at 8KB — and memoised on the parameter, so it runs once per
  // distinct URL rather than once per keystroke.
  const decoded = useMemo(
    () => (runId ? null : decodePrefill(prefillParam)),
    [prefillParam, runId],
  );
  const prefilled = decoded !== null;

  // Latest callbacks without making them effect dependencies: the setters are
  // rebuilt every render, and depending on them would re-run the effect — and
  // re-apply the prefill over the teacher's edits — on every keystroke.
  //
  // Written in an effect rather than during render. Assigning to a ref while
  // rendering is unsafe under concurrent React, where a render can be discarded
  // or replayed; effects only run for renders that were committed.
  const ref = useRef(opts);
  useEffect(() => {
    ref.current = opts;
  });

  // Guard against re-applying after the teacher has started editing.
  const appliedRun = useRef<string | null>(null);
  const appliedPrefill = useRef<string | null>(null);

  // ?run= wins when both are present: a saved run is a real artefact, a prefill
  // is only a suggestion about one that does not exist yet.
  useEffect(() => {
    if (!runId || appliedRun.current === runId) return;
    appliedRun.current = runId;
    let cancelled = false;
    void (async () => {
      try {
        const run = await getToolRun(runId);
        // A missing run — or someone else's, which RLS makes indistinguishable —
        // opens the tool empty. Better than an error page for a link that may
        // simply be old.
        if (!cancelled && run) ref.current.onRestore(run);
      } catch {
        /* Same outcome as not found. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runId]);

  useEffect(() => {
    if (!decoded || !prefillParam) return;
    if (appliedPrefill.current === prefillParam) return;

    const setters = ref.current.prefill;
    if (!setters) return;

    appliedPrefill.current = prefillParam;

    // Every registered setter is called, not just the ones the assistant filled.
    //
    // Several fields persist in localStorage and are shared across tools
    // (ll:yearGroup, ll:curriculum), so a field the assistant did NOT fill would
    // otherwise keep whatever was last chosen in some other tool. A teacher who
    // asks for a Year 6 quiz and gets Year 5 — because that is what they picked
    // last week — reads it as the assistant ignoring them. Clearing is the only
    // way a prefill can mean "these are the fields, and nothing else".
    //
    // Only on the prefill path: ?run= restores a saved artefact, where blanking
    // an unset field would destroy real data.
    const schema = assistantToolFor(decoded.slug)?.fields as
      | { properties?: Record<string, { type?: string }> }
      | undefined;

    for (const [key, setter] of Object.entries(setters)) {
      const value = decoded.fields[key];
      if (value !== undefined) {
        setter(value);
        continue;
      }
      // Only the field types that actually carry stale values are cleared, and
      // only with a value of the right shape — the setters cast blindly
      // (`v as string[]`), so the wrong shape would corrupt form state.
      //
      // Numbers are left alone deliberately: they are initialised to real
      // defaults (numQuestions starts at 5, not at nothing), and there is no
      // empty number. Blanking one would put "" into a numeric control and
      // break Generate — a worse bug than the one being fixed.
      const type = schema?.properties?.[key]?.type;
      if (type === "array") setter([]);
      else if (type === "string") setter("");
    }
  }, [decoded, prefillParam]);

  return { prefilled };
}
