// Renders an email template for the /admin/emails preview.
//
// This has to be a route rather than something the page computes, for two
// reasons: app/lib/email.ts is server-only (it holds the service-role client
// and the SendGrid key), and the preview needs to show wording the admin is
// still typing, which by definition has not been saved yet.
//
// Nothing here sends. generateEmailHtml renders and returns.
import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/auth/admin";
import { generateEmailHtml, interpolate } from "@/app/lib/email";
import { TEMPLATES, type EmailTemplateKey } from "@/app/lib/email-templates";
import { SAMPLE_PARAMS } from "@/app/lib/email-templates/samples";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  await requireAdmin();

  const { key, subject, body } = (await req.json()) as {
    key?: string;
    subject?: string | null;
    body?: string | null;
  };

  // A row in email_templates with no renderer cannot be previewed, because
  // there is no HTML to render — that is the same reason it cannot send.
  if (!key || !(key in TEMPLATES)) {
    return NextResponse.json({ error: "no renderer for this template" }, { status: 400 });
  }

  const templateKey = key as EmailTemplateKey;
  const params = SAMPLE_PARAMS[templateKey];

  const rendered = generateEmailHtml(templateKey, params, body ?? null);
  if (!rendered) {
    return NextResponse.json({ error: "render failed" }, { status: 400 });
  }

  return NextResponse.json({
    // Same precedence as sendTemplate: an admin-set subject wins over the
    // template's default, and it interpolates through the exported helper so
    // the preview and the real send can never disagree.
    subject: subject?.trim() ? interpolate(subject, params) : rendered.subject,
    html: rendered.html,
  });
}
