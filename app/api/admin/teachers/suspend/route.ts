import { NextRequest, NextResponse } from "next/server";
import { requireAdminRoute } from "@/app/lib/auth/admin-route";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { sendTemplate } from "@/app/lib/email";

// Suspends or restores a teacher's account.
//
// Two writes have to agree here. auth.users.banned_until is what actually stops
// a login; profiles.suspended_at is the cheap read surface the Teachers table
// filters and renders from. The profile write goes first and is rolled back if
// the ban fails, so the flag can never claim "suspended" while the account
// still works. The reverse ordering would leave a banned user showing as
// active, which is worse: staff would see nothing wrong.
const BAN_FOREVER = "876000h"; // ~100 years; Supabase has no true "permanent"

export async function POST(req: NextRequest) {
  const gate = await requireAdminRoute("suspend_accounts");
  if (gate.error) return gate.error;

  const body = await req.json().catch(() => null);
  const userId = typeof body?.userId === "string" ? body.userId : "";
  const suspend = body?.suspend === true;
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  const notify = body?.notify === true;

  if (!userId) {
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }
  if (userId === gate.user.id) {
    return NextResponse.json(
      { error: "You can't suspend your own account." },
      { status: 400 },
    );
  }

  const { data: target } = await supabaseAdmin
    .from("profiles")
    .select("is_admin, suspended_at")
    .eq("id", userId)
    .maybeSingle();
  if (!target) {
    return NextResponse.json({ error: "Could not find that teacher." }, { status: 404 });
  }
  // Suspending a colleague through the console would be an odd way to resolve a
  // dispute, and locking out the last super admin is unrecoverable from the UI.
  if (target.is_admin) {
    return NextResponse.json(
      { error: "Admin accounts can't be suspended from here." },
      { status: 400 },
    );
  }

  const previous = target.suspended_at;

  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .update({
      suspended_at: suspend ? new Date().toISOString() : null,
      suspended_reason: suspend ? reason || null : null,
      suspended_by: suspend ? gate.user.id : null,
    })
    .eq("id", userId);
  if (profileError) {
    return NextResponse.json({ error: "Could not update the account." }, { status: 500 });
  }

  const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    ban_duration: suspend ? BAN_FOREVER : "none",
  });
  if (banError) {
    // Put the flag back so the table doesn't advertise a suspension that isn't
    // being enforced. Same rollback shape as create-teacher's profile insert.
    await supabaseAdmin
      .from("profiles")
      .update({
        suspended_at: previous,
        suspended_reason: suspend ? null : undefined,
        suspended_by: suspend ? null : undefined,
      })
      .eq("id", userId);
    return NextResponse.json(
      { error: "Could not change the account's sign-in status. Nothing was changed." },
      { status: 500 },
    );
  }

  // A ban blocks new logins but leaves any already-issued JWT valid until it
  // expires, so a suspended teacher could keep working for up to an hour.
  // Revoking their sessions makes the suspension take effect now.
  if (suspend) {
    const { error: signOutError } = await supabaseAdmin.auth.admin.signOut(userId, "global");
    if (signOutError) {
      // Not fatal: they're banned either way, just not instantly.
      console.warn("[suspend] could not revoke sessions", userId, signOutError.message);
    }
  }

  let emailed = false;
  if (suspend && notify) {
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (authUser.user?.email) {
      emailed = await sendTemplate("account_suspended", authUser.user.email, { reason });
    }
  }

  await gate.supabase.rpc("admin_log_suspension", {
    uid: userId,
    p_suspend: suspend,
    p_reason: reason || null,
  });

  return NextResponse.json({ suspended: suspend, emailed });
}
