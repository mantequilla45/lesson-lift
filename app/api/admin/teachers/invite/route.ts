import { NextRequest, NextResponse } from "next/server";
import { requireAdminRoute } from "@/app/lib/auth/admin-route";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { sendTemplate, siteUrl } from "@/app/lib/email";
import { SELECTABLE_PLANS } from "@/app/lib/plans";

// Invites teachers by email.
//
// Each invite is a Supabase invite link (generateLink) delivered through
// SendGrid rather than Supabase's own mailer, so the copy lives in this repo
// and bulk sends aren't subject to the auth mailer's rate limit. The link lands
// on /auth/callback; since an invited user has no profiles row yet, that route
// forwards them to /create-password and then /complete-profile.
//
// Sequential, not Promise.all: 200 parallel calls would hit both Supabase's
// admin API and SendGrid hard, and per-address results are more useful to the
// admin than a single rejected promise.

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MAX_EMAILS = 200;

type Result = {
  email: string;
  status: "sent" | "exists" | "failed";
  error?: string;
};

export async function POST(req: NextRequest) {
  const gate = await requireAdminRoute("invite_teachers");
  if (gate.error) return gate.error;

  const body = await req.json().catch(() => null);
  const rawEmails: unknown = body?.emails;
  const plan = typeof body?.plan === "string" ? body.plan : "free";

  if (!Array.isArray(rawEmails)) {
    return NextResponse.json({ error: "emails must be an array." }, { status: 400 });
  }
  // Validate the plan server-side too — the dropdown only offers Free and Pro,
  // but a crafted request must not be able to place someone on a retired or
  // unbuilt plan.
  if (!SELECTABLE_PLANS.some((p) => p.id === plan)) {
    return NextResponse.json({ error: `Can't invite anyone onto the ${plan} plan.` }, { status: 400 });
  }

  const emails = [
    ...new Set(
      rawEmails
        .filter((e): e is string => typeof e === "string")
        .map((e) => e.trim().toLowerCase())
        .filter((e) => EMAIL_RE.test(e)),
    ),
  ];

  if (emails.length === 0) {
    return NextResponse.json({ error: "No valid email addresses." }, { status: 400 });
  }
  if (emails.length > MAX_EMAILS) {
    return NextResponse.json(
      { error: `That's ${emails.length} addresses — ${MAX_EMAILS} is the most we'll send at once.` },
      { status: 400 },
    );
  }

  const redirectTo = `${siteUrl()}/auth/callback`;
  const results: Result[] = [];

  for (const email of emails) {
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        redirectTo,
        // An invited user has no profiles row yet — that absence is what makes
        // /auth/callback send them through onboarding — so the chosen plan has
        // nowhere to live until they finish. Stash it on the auth user and let
        // the profile pick it up when it's created.
        data: { invited_plan: plan },
      },
    });

    if (error) {
      // generateLink refuses an address that already has an auth user. That's
      // the common "already invited / already a member" case, not a failure
      // worth aborting the batch for.
      const msg = error.message ?? "";
      results.push(
        /already|registered|exists/i.test(msg)
          ? { email, status: "exists" }
          : { email, status: "failed", error: msg || "Could not create the invite." },
      );
      continue;
    }

    const actionLink = link?.properties?.action_link;
    if (!actionLink) {
      results.push({ email, status: "failed", error: "No invite link was returned." });
      continue;
    }

    const sent = await sendTemplate("teacher_invite", email, {
      inviteUrl: actionLink,
      inviterName: gate.user.email ?? "",
    });

    results.push(
      sent
        ? { email, status: "sent" }
        : { email, status: "failed", error: "Account created, but the email couldn't be sent." },
    );
  }

  const sent = results.filter((r) => r.status === "sent").length;
  await gate.supabase.rpc("admin_log_invites", {
    p_sent: sent,
    p_requested: emails.length,
    p_plan: plan,
  });

  // 200 even when some rows failed: the client renders a per-address report,
  // which is more useful than a blanket error for a partially-successful batch.
  return NextResponse.json({ sent, requested: emails.length, results });
}
