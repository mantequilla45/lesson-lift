import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/lib/auth/server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { sendTemplate, siteUrl } from "@/app/lib/email";
import { newInviteToken, hashInviteToken, inviteExpiry } from "@/app/lib/invites";

/*
 * A teacher inviting a colleague.
 *
 * The mechanism is the one that already exists: a row in `pending_invites` plus
 * an emailed link to /signup?invite=<token>, consumed by /api/invites/accept.
 * Reusing it rather than building a parallel table means one expiry rule, one
 * hashed-token discipline and one accept path.
 *
 * WHY THIS IS A ROUTE AND NOT A CLIENT CALL
 *
 * `pending_invites` has RLS enabled with no policies at all, deliberately: every
 * access is service role or a definer function. The token is a bearer
 * credential and must only ever exist in the email, never in a response body,
 * so it has to be minted somewhere the browser cannot see. That is here.
 *
 * WHY NOT upsert_invite()
 *
 * That function gates on is_admin(), because an admin invite carries a PLAN. A
 * teacher inviting a colleague must never be able to hand out a paid seat, so
 * this writes its own row with plan pinned to 'free' rather than loosening the
 * admin path to accept a caller who is not one.
 *
 * WHAT IS NOT HERE
 *
 * The referral bonus. The prototype's modal promises 200 credits both ways, and
 * the developer handover lists that number as an open decision (§8.3). There is
 * also no credit ledger to write it to: allowances are grants plus derivation.
 * So the invite works and the copy does not mention credits. When the number is
 * settled, the grant and the sentence ship together.
 */

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "That does not look like an email address." }, { status: 400 });
  }

  if (email === user.email?.toLowerCase()) {
    return NextResponse.json({ error: "That is your own address." }, { status: 400 });
  }

  // Already a teacher here. Reported plainly rather than sending an invite they
  // cannot accept: the right move is to search for them and add them, which is
  // what the message says.
  //
  // The teacher's own session, not the service role: existing_member_emails
  // reads auth.uid() through is_admin() and is not admin-gated for this use.
  const { data: memberRows } = await supabase.rpc("existing_member_emails", {
    p_emails: [email],
  });
  if ((memberRows ?? []).length > 0) {
    return NextResponse.json(
      { error: "They are already on Jooma. Search for them by email and add them instead." },
      { status: 409 },
    );
  }

  const token = newInviteToken();

  // Service role, because pending_invites denies everything else. Delete then
  // insert, matched on lower(email), mirroring the partial unique index the
  // admin path documents: a row stored with different casing would survive an
  // exact-match delete and then collide on insert.
  //
  // plan is pinned to 'free' here and is not taken from the request. A teacher
  // must not be able to invite anyone onto a paid seat.
  await supabaseAdmin
    .from("pending_invites")
    .delete()
    .is("accepted_at", null)
    .ilike("email", email);

  const { error } = await supabaseAdmin.from("pending_invites").insert({
    email,
    plan: "free",
    token_hash: hashInviteToken(token),
    invited_by: user.id,
    expires_at: inviteExpiry(),
  });

  if (error) {
    return NextResponse.json({ error: "That invite could not be created." }, { status: 500 });
  }

  const sent = await sendTemplate("teacher_invite", email, {
    inviteUrl: `${siteUrl()}/signup?invite=${encodeURIComponent(token)}`,
    inviterName: user.email ?? "",
  });

  if (!sent) {
    return NextResponse.json(
      { error: "The invite was created, but the email could not be sent." },
      { status: 502 },
    );
  }

  // The token is never returned. It exists in the email and nowhere else.
  return NextResponse.json({ ok: true });
}
