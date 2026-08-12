import { NextRequest, NextResponse } from "next/server";
import { requireAdminRoute } from "@/app/lib/auth/admin-route";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

// Revokes a pending invite. An invited-not-yet-accepted teacher is just an
// auth.users row with no profiles row (see admin_pending_invites() in
// 20260812000100_pending_invites.sql) — there's nothing else referencing it
// yet, so undoing the invite is a straight delete of that auth user, gated
// behind the same permission as sending one.
export async function POST(req: NextRequest) {
  const gate = await requireAdminRoute("invite_teachers");
  if (gate.error) return gate.error;

  const body = await req.json().catch(() => null);
  const userId = typeof body?.userId === "string" ? body.userId : "";
  if (!userId) {
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (profile) {
    // Already completed onboarding — this isn't a pending invite anymore, and
    // deleting the auth user would take a real account down with it.
    return NextResponse.json(
      { error: "That teacher has already accepted — this isn't a pending invite." },
      { status: 400 },
    );
  }

  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
  const email = authUser.user?.email ?? "";

  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) {
    return NextResponse.json({ error: "Could not revoke the invite." }, { status: 500 });
  }

  await gate.supabase.rpc("admin_log_revoke_invite", { p_email: email });

  return NextResponse.json({ revoked: true });
}
