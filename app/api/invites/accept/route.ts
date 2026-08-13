import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/lib/auth/server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { lookupInvite } from "@/app/lib/invites";

// Consumes an invite for the signed-in user.
//
// Called by /complete-profile once the profile row exists. Splitting it out of
// that page is deliberate: the plan an invite grants must be decided by the
// SERVER from a token it verifies itself. If the client could name its own
// plan — or if the page trusted a value it read out of the query string —
// anyone could self-assign Pro by visiting /signup?invite=<anything>.
//
// Two checks that both have to pass:
//   1. The token resolves to an open, unexpired invite (lookupInvite).
//   2. That invite's address matches the signed-in user's address.
//
// (2) is what stops an invite being consumed by an account it wasn't meant for
// — the common case being a teacher who clicks the link then signs in with a
// personal Google account. Better to tell them plainly than to silently bind a
// school's paid seat to the wrong identity.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";

  const result = await lookupInvite(token);
  if (!result.ok) {
    const message =
      result.reason === "expired"
        ? "That invitation has expired. Ask your administrator for a new one."
        : result.reason === "accepted"
        ? "That invitation has already been used."
        : "That invitation link isn't valid.";
    return NextResponse.json({ error: message, reason: result.reason }, { status: 400 });
  }

  const invite = result.invite;
  const userEmail = (user.email ?? "").toLowerCase();

  if (invite.email.toLowerCase() !== userEmail) {
    return NextResponse.json(
      {
        error: `This invitation was sent to ${invite.email}. Sign in with that address to accept it.`,
        reason: "email_mismatch",
      },
      { status: 400 },
    );
  }

  // Service-role for both writes: `plan` is deliberately not self-updatable by
  // a teacher (see 20260811000400_lock_down_profile_self_update.sql), which is
  // the whole reason this has to happen server-side.
  const { error: planError } = await supabaseAdmin
    .from("profiles")
    .update({ plan: invite.plan })
    .eq("id", user.id);

  if (planError) {
    return NextResponse.json({ error: "Could not apply your invitation." }, { status: 500 });
  }

  // Consume it. Conditioned on accepted_at still being null so two concurrent
  // requests can't both claim the same invite.
  await supabaseAdmin
    .from("pending_invites")
    .update({ accepted_at: new Date().toISOString(), accepted_by: user.id })
    .eq("id", invite.id)
    .is("accepted_at", null);

  return NextResponse.json({ accepted: true, plan: invite.plan });
}
