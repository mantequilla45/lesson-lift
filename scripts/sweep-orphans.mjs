/*
 * Reclaim Storage objects that nothing points at any more.
 *
 *   node scripts/sweep-orphans.mjs              list them, delete nothing
 *   node scripts/sweep-orphans.mjs --delete     actually remove them
 *   node scripts/sweep-orphans.mjs --min-age-hours 48
 *
 * WHY THIS EXISTS
 *
 * Deleting a resource used to be a bare row delete. Nothing records which
 * Storage objects belong to which resource, so the deleted row was the only
 * index of its own files and every one of them stayed in the bucket forever.
 * Measured on staging: 189 objects, 138 MB, about 16% of everything stored.
 *
 * The delete route now reclaims files as it goes, so the leak has stopped. This
 * clears what leaked before it did, and nothing else: it is a one-off, not a
 * cron job. Run it after the route has shipped.
 *
 * WHAT COUNTS AS ORPHANED
 *
 * An object no longer named by ANY of the five places a reference can live:
 * generated_images.data_url, tool_runs.output, tool_runs.input,
 * presentations.slides, shares.output. Same set the delete route checks through
 * storage_paths_in_use(); the query is repeated here rather than reusing the
 * RPC because this needs to ask about thousands of paths at once.
 *
 * SAFETY
 *
 *   - Dry run by DEFAULT. Deleting needs --delete, typed on purpose.
 *   - An age floor (24h by default). uploadImageBytes() returns before the deck
 *     that will reference it is saved, so a file uploaded moments ago is not
 *     orphaned, it is in flight. Sweeping it would delete a picture out of
 *     somebody's half-finished slideshow.
 *   - Avatars are never touched: they belong to a profile, not a resource, and
 *     are not in any of the columns above, so every one of them would look
 *     orphaned.
 *
 * RUN IT ON STAGING FIRST and reconcile the count before pointing it anywhere
 * else.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

/* ── Environment ─────────────────────────────────────────────────────────── */

// .env.local by hand: standalone script, no Next.js runtime to load it. The \r
// strip matters on Windows, where CRLF otherwise ends up inside every value.
for (const raw of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const line = raw.trim();
  if (line === "" || line.startsWith("#")) continue;
  const m = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
  if (m && !process.env[m[1]]) {
    process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local.");
  process.exit(1);
}

const db = createClient(URL, SERVICE, { auth: { persistSession: false } });

/* ── Options ─────────────────────────────────────────────────────────────── */

const argv = process.argv.slice(2);
const DELETE = argv.includes("--delete");
const ageIndex = argv.indexOf("--min-age-hours");
const MIN_AGE_HOURS = ageIndex >= 0 ? Number(argv[ageIndex + 1]) : 24;

if (!Number.isFinite(MIN_AGE_HOURS) || MIN_AGE_HOURS < 0) {
  console.error("--min-age-hours needs a non-negative number.");
  process.exit(1);
}

// Deliberately not 'avatars'. See the header.
const BUCKETS = ["images", "audio", "video"];

const bytes = (n) =>
  n > 1024 ** 3
    ? `${(n / 1024 ** 3).toFixed(2)} GB`
    : n > 1024 ** 2
      ? `${(n / 1024 ** 2).toFixed(1)} MB`
      : `${(n / 1024).toFixed(0)} kB`;

/* ── The sweep ───────────────────────────────────────────────────────────── */

/** Every object in a bucket, paged: list() caps at 100 by default and 1000 at
 *  most, and these buckets are well past that. */
async function listAll(bucket) {
  const out = [];
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await db.storage
      .from(bucket)
      .list("", { limit: PAGE, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`Could not list ${bucket}: ${error.message}`);
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
}

/**
 * Which of these paths are still referenced?
 *
 * Asked in chunks. The check is a LIKE per path against five columns, so the
 * whole bucket in one statement is a good way to time out a database — as an
 * earlier attempt at exactly this query did.
 */
async function referenced(paths) {
  const live = new Set();
  // 50, not 200. Each path costs a LIKE scan across five columns, two of them
  // jsonb cast to text, so the work is chunk size times table size. 200 blew
  // the statement timeout on a bucket of ~950 objects; this is comfortably
  // inside it and the whole sweep still takes under a minute.
  const CHUNK = 50;
  for (let i = 0; i < paths.length; i += CHUNK) {
    const slice = paths.slice(i, i + CHUNK);
    const { data, error } = await db.rpc("storage_paths_in_use", { p_paths: slice });
    if (error) throw new Error(`Reference check failed: ${error.message}`);
    for (const row of data ?? []) live.add(row.path);
    process.stdout.write(`\r  checked ${Math.min(i + CHUNK, paths.length)}/${paths.length}`);
  }
  process.stdout.write("\r".padEnd(40) + "\r");
  return live;
}

async function main() {
  console.log(`Project: ${URL}`);
  console.log(DELETE ? "Mode:    DELETE" : "Mode:    dry run (pass --delete to remove)");
  console.log(`Keeping anything newer than ${MIN_AGE_HOURS}h.\n`);

  const cutoff = Date.now() - MIN_AGE_HOURS * 3600 * 1000;
  let totalOrphans = 0;
  let totalBytes = 0;
  let totalRemoved = 0;

  for (const bucket of BUCKETS) {
    const objects = await listAll(bucket);
    if (objects.length === 0) {
      console.log(`${bucket}: empty`);
      continue;
    }

    const old = objects.filter((o) => {
      const at = o.created_at ?? o.updated_at;
      return at ? new Date(at).getTime() < cutoff : true;
    });
    const tooNew = objects.length - old.length;

    const live = await referenced(old.map((o) => o.name));
    const orphans = old.filter((o) => !live.has(o.name));
    const size = orphans.reduce((a, o) => a + (o.metadata?.size ?? 0), 0);

    totalOrphans += orphans.length;
    totalBytes += size;

    console.log(
      `${bucket}: ${objects.length} objects, ${orphans.length} orphaned (${bytes(size)})` +
        (tooNew ? `, ${tooNew} too new to judge` : ""),
    );

    if (!DELETE || orphans.length === 0) continue;

    // remove() takes a batch, but not an unbounded one.
    const BATCH = 100;
    for (let i = 0; i < orphans.length; i += BATCH) {
      const names = orphans.slice(i, i + BATCH).map((o) => o.name);
      const { error } = await db.storage.from(bucket).remove(names);
      if (error) {
        console.error(`  could not remove a batch from ${bucket}: ${error.message}`);
        continue;
      }
      totalRemoved += names.length;
      process.stdout.write(`\r  removed ${totalRemoved}`);
    }
    process.stdout.write("\r".padEnd(40) + "\r");
  }

  console.log(
    `\n${totalOrphans} orphaned objects, ${bytes(totalBytes)}.` +
      (DELETE ? ` Removed ${totalRemoved}.` : " Nothing was deleted."),
  );
  if (!DELETE && totalOrphans > 0) {
    console.log("Re-run with --delete to reclaim them.");
  }
}

main().catch((err) => {
  console.error("\nSweep failed:", err.message);
  process.exit(1);
});
