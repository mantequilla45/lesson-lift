import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/lib/auth/server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { extractStorageRefs, type StorageRef } from "@/app/lib/storageRefs";

// Deleting a resource, and the files it owns along with it.
//
// WHY THIS IS A ROUTE AND NOT A CLIENT DELETE
//
// Deleting the row is trivial and RLS already allows it from the browser. The
// files are the problem: nothing records which Storage objects belong to which
// resource, so the row being deleted is the ONLY index of its own files. Once
// it is gone, nothing will ever look for them again and they are billed for
// forever. The order below is therefore load bearing — read, then delete, then
// sweep.
//
// It also runs server side because the resource buckets still carry open anon
// delete policies from the MVP (20260521000100_create_images_bucket.sql). A
// client-side storage.remove() would work today by leaning on exactly the hole
// that ought to be closed; the service role does not care either way, so this
// keeps working when those policies are tightened.
//
// WHAT IS DELIBERATELY NOT DELETED
//
// `token_usage`, `asset_cost` and `slide_cost` are never touched. They link to
// a run through a bare `run_id` with NO foreign key (20260811000800), and that
// is deliberate: the spend happened, and monitoring, margin and the cost
// ceiling all depend on the history staying complete. An orphaned run_id looks
// like a bug and is not one. Do NOT "tidy up" these rows and do NOT add the FK.

/**
 * Which of these objects are still pointed at by something else?
 *
 * One RPC rather than queries from here, for a reason worth keeping written
 * down: two of the five places a reference can live are jsonb, and PostgREST
 * cannot LIKE against jsonb —
 *
 *   .like('slides::text', '%f.png%')  ->  operator does not exist: jsonb ~~ unknown
 *
 * and, critically, that error is INVISIBLE through a `head: true` count. It
 * comes back as count `null`, not as an error, which reads exactly like "no
 * references" and would delete a file that is still on a slide. The function
 * (20260909000000_storage_reference_check.sql) does the whole check in SQL, so
 * a failure is a real failure.
 *
 * Errs towards KEEPING files: on any error every candidate is treated as still
 * in use. Leaking a file costs storage; deleting one that is still referenced
 * puts a broken image in somebody's lesson.
 */
async function stillInUse(refs: StorageRef[], excludeId: string): Promise<Set<string>> {
  const paths = refs.map((r) => r.path);
  const { data, error } = await supabaseAdmin.rpc("storage_paths_in_use", {
    p_paths: paths,
    p_exclude_id: excludeId,
  });

  if (error) {
    console.error("[resources/delete] reference check failed", error);
    return new Set(paths); // keep everything
  }

  const rows = (data ?? []) as { path: string }[];
  return new Set(rows.map((r) => r.path));
}

/** Remove the objects nothing points at any more. Best effort throughout: the
 *  row is already gone and that was what the teacher asked for, so a storage
 *  failure is logged rather than surfaced as a failed delete. */
async function sweepFiles(refs: StorageRef[], excludeId: string): Promise<number> {
  if (refs.length === 0) return 0;

  const keep = await stillInUse(refs, excludeId);

  // Group by bucket so each bucket takes one remove() call rather than one per
  // file.
  const byBucket = new Map<string, string[]>();

  for (const ref of refs) {
    if (keep.has(ref.path)) continue;
    const list = byBucket.get(ref.bucket) ?? [];
    list.push(ref.path);
    byBucket.set(ref.bucket, list);
  }

  let removed = 0;
  for (const [bucket, paths] of byBucket) {
    const { error } = await supabaseAdmin.storage.from(bucket).remove(paths);
    if (error) {
      console.error("[resources/delete] storage remove failed", bucket, paths.length, error);
      continue;
    }
    removed += paths.length;
  }
  return removed;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const kind = body?.kind === "presentation" ? "presentation" : "run";

  if (!id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  const table = kind === "presentation" ? "presentations" : "tool_runs";
  const columns = kind === "presentation" ? "id, user_id, slides" : "id, user_id, output, input";

  // 1. Read it BEFORE deleting — this is the only moment the file list exists.
  //    Ownership is re-checked here against the row itself rather than trusted
  //    from the body, so a crafted id cannot delete somebody else's resource.
  const { data: row, error: readErr } = await supabaseAdmin
    .from(table)
    .select(columns)
    .eq("id", id)
    .maybeSingle<Record<string, unknown>>();

  if (readErr) {
    console.error("[resources/delete] could not read the resource", readErr);
    return NextResponse.json({ error: "Could not delete that resource." }, { status: 500 });
  }
  // Absent and not-yours are answered identically: a 404 either way tells a
  // prober nothing about what exists.
  if (!row || row.user_id !== user.id) {
    return NextResponse.json({ error: "Could not find that resource." }, { status: 404 });
  }

  const refs =
    kind === "presentation"
      ? extractStorageRefs(JSON.stringify(row.slides ?? null))
      : extractStorageRefs(
          typeof row.output === "string" ? row.output : null,
          JSON.stringify(row.input ?? null),
        );

  // 2. Delete the row. This is the part that must succeed.
  const { error: delErr } = await supabaseAdmin.from(table).delete().eq("id", id);
  if (delErr) {
    console.error("[resources/delete] row delete failed", delErr);
    return NextResponse.json({ error: "Could not delete that resource." }, { status: 500 });
  }

  // 3. Reclaim whatever nothing else is using. Never fails the request: the
  //    resource is already gone, which is what was asked for.
  let removed = 0;
  try {
    removed = await sweepFiles(refs, id);
  } catch (err) {
    console.error("[resources/delete] storage sweep failed", err);
  }

  return NextResponse.json({ ok: true, files: { found: refs.length, removed } });
}
