import { NextRequest, NextResponse } from "next/server";
import { requireAdminRoute } from "@/app/lib/auth/admin-route";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

// Revokes a pending invite.
//
// An invite is now a `pending_invites` row and nothing else — it no longer
// pre-creates an auth user — so revoking is a straight delete of that row,
// gated behind the same permission as sending one. The emailed token stops
// resolving the moment the row is gone.
//
// `id` is the invite's id, not a user id: an unaccepted invite has no user yet.
export async function POST(req: NextRequest) {
  const gate = await requireAdminRoute("invite_teachers");
  if (gate.error) return gate.error;

  const body = await req.json().catch(() => null);
  const inviteId = typeof body?.inviteId === "string" ? body.inviteId : "";
  if (!inviteId) {
    return NextResponse.json({ error: "inviteId is required." }, { status: 400 });
  }

  const { data: invite } = await supabaseAdmin
    .from("pending_invites")
    .select("id, email, accepted_at")
    .eq("id", inviteId)
    .maybeSingle();

  if (!invite) {
    return NextResponse.json({ error: "That invite no longer exists." }, { status: 404 });
  }
  if (invite.accepted_at) {
    // Already onboarded — revoking now would suggest it undoes their account,
    // which it doesn't. Suspending the teacher is the tool for that.
    return NextResponse.json(
      { error: "That teacher has already accepted — this isn't a pending invite." },
      { status: 400 },
    );
  }

  const { error } = await supabaseAdmin
    .from("pending_invites")
    .delete()
    .eq("id", inviteId)
    .is("accepted_at", null);

  if (error) {
    return NextResponse.json({ error: "Could not revoke the invite." }, { status: 500 });
  }

  await gate.supabase.rpc("admin_log_revoke_invite", { p_email: invite.email });

  return NextResponse.json({ revoked: true });
}
