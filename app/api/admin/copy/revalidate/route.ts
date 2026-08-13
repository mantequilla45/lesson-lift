// Busts the cached `public_copy` read after an admin publishes.
//
// /admin/copy publishes through supabase.rpc("admin_publish_copy"), which talks
// to Postgres directly and never touches Next — so without this the new wording
// would sit behind the 300s cache in app/lib/copy.ts, and an admin who checked
// the live site immediately would conclude publishing was broken.
//
// Called fire-and-forget from CopyView: a failure here is not worth surfacing,
// because the TTL still expires on its own. That is why there is no body, no
// parameters and nothing to get wrong — the whole route is "the copy changed".
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { requireAdmin } from "@/app/lib/auth/admin";
import { COPY_TAG } from "@/app/lib/copy";

export async function POST() {
  // The RPC behind the publish already enforces is_admin() and the edit_copy
  // permission in the database. This is here so the route itself is not an
  // unauthenticated cache-buster.
  await requireAdmin();

  // Two-argument form. Bare revalidateTag(tag) is deprecated in Next 16 and
  // expires the entry immediately, forcing the next visitor to block on a cache
  // miss; "max" marks it stale and serves the old value while the new one is
  // fetched behind them.
  revalidateTag(COPY_TAG, "max");

  return NextResponse.json({ ok: true });
}
