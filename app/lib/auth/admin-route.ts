// Route-handler twin of requireAdmin() (app/lib/auth/admin.ts), which redirects
// and therefore only suits pages. A route returns JSON status codes instead.
//
// IMPORTANT: unlike the admin_* RPCs — where the DB's is_admin() check is the
// real security boundary and the app-side gate is only UX — the routes that use
// this helper go on to mutate through the SERVICE ROLE, which bypasses RLS
// entirely. Here this check *is* the boundary. It must not be skipped, and the
// permission argument should be passed wherever role_permissions has a matching
// row.
import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "./server";

type AdminRouteResult =
  | { error: NextResponse; user?: never; supabase?: never }
  | { error?: never; user: User; supabase: SupabaseClient };

/**
 * Verify the caller is a signed-in admin, optionally holding a specific staff
 * permission. Returns either an `error` response to return immediately, or the
 * caller's `user` plus their (RLS-bound, non-service-role) client.
 *
 * @param permission a role_permissions.permission value, e.g. "suspend_accounts"
 */
export async function requireAdminRoute(permission?: string): Promise<AdminRouteResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: caller } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!caller?.is_admin) {
    return { error: NextResponse.json({ error: "Not authorized" }, { status: 403 }) };
  }

  if (permission) {
    // admin_can() is security definer and re-checks is_admin() itself. Note an
    // admin with no admin_team row resolves to super_admin (see
    // 20260805001700_content_and_roles.sql) — deliberate, so adding the role
    // layer could never lock out the existing admins.
    const { data: allowed, error } = await supabase.rpc("admin_can", {
      p_permission: permission,
    });
    if (error || allowed !== true) {
      return {
        error: NextResponse.json(
          { error: `Your admin role doesn't allow this (${permission}).` },
          { status: 403 },
        ),
      };
    }
  }

  return { user, supabase };
}
