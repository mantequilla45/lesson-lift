import { NextRequest, NextResponse } from "next/server";
import { requireAdminRoute } from "@/app/lib/auth/admin-route";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { sendTemplate, siteUrl } from "@/app/lib/email";

// Sends a teacher a password reset link on an admin's behalf.
//
// generateLink() mints the recovery token without sending anything — Supabase's
// own mailer is bypassed so the email goes out through SendGrid with our
// template. The link lands on /auth/callback, which exchanges the code and,
// because the teacher already has a profile row, forwards them to
// /create-password with a live session to set a new one.
export async function POST(req: NextRequest) {
  const gate = await requireAdminRoute("reset_passwords");
  if (gate.error) return gate.error;

  const body = await req.json().catch(() => null);
  const userId = typeof body?.userId === "string" ? body.userId : "";
  if (!userId) {
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }

  const { data: target, error: lookupError } =
    await supabaseAdmin.auth.admin.getUserById(userId);
  if (lookupError || !target.user?.email) {
    return NextResponse.json({ error: "Could not find that teacher." }, { status: 404 });
  }
  const email = target.user.email;

  const { data: link, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${siteUrl()}/auth/callback?next=/create-password` },
  });
  if (linkError || !link.properties?.action_link) {
    return NextResponse.json(
      { error: "Could not generate a reset link. Please try again." },
      { status: 500 },
    );
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("first_name")
    .eq("id", userId)
    .maybeSingle();

  const sent = await sendTemplate("password_reset", email, {
    resetUrl: link.properties.action_link,
    firstName: profile?.first_name ?? "",
  });

  await gate.supabase.rpc("admin_log_password_reset", { uid: userId, p_sent: sent });

  // Report what actually happened. The old stub claimed an email "would be
  // sent"; saying it was sent when SendGrid isn't configured would be the same
  // lie with extra steps.
  return NextResponse.json({
    sent,
    email,
    error: sent ? undefined : "Email isn't configured, so nothing was sent.",
  });
}
