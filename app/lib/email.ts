// ── Transactional email ──────────────────────────────────────────────────────
// SendGrid over its HTTP API. Supabase's built-in auth mailer is deliberately
// not used: its templates live in the Supabase dashboard rather than this repo,
// which would leave /admin/emails decorative, and its send rate limits bite on
// a bulk invite. Supabase still mints the auth tokens (generateLink), so no
// token or session logic lives here — only delivery.
//
// Subject lines and the live/paused switch come from the email_templates table
// so an admin can reword or pause an email without a deploy. The HTML bodies
// stay in code: they compose layout()/button(), they're reviewable in a diff,
// and hand-editing transactional HTML in a textarea is a footgun.
import "server-only";
import sgMail from "@sendgrid/mail";
import { supabaseAdmin } from "./supabase-admin";
import { TEMPLATES, type EmailTemplateKey } from "./email-templates";
import { escapeHtml, siteUrl } from "./email-templates/shared";

export type { EmailTemplateKey };
// Defined alongside the templates so they can use them without importing this
// module (which imports the template registry) and creating a cycle.
export { escapeHtml, siteUrl, button } from "./email-templates/shared";

let ready = false;

/** Set the API key on first use. Returns false when the key is absent, which
 *  every caller treats as "not sent" rather than an error — see send(). */
function init(): boolean {
  if (ready) return true;
  const key = process.env.SENDGRID_API_KEY;
  if (!key) return false;
  sgMail.setApiKey(key);
  ready = true;
  return true;
}

/** Whether email is configured at all. Used by /admin/emails to show whether
 *  these templates are actually going anywhere. */
export function mailerConfigured(): boolean {
  return Boolean(process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL);
}

/** Shared shell for every email: accent bar, logo, card, footer.
 *  Table-based and inline-styled because that is what email clients render. */
export function layout(content: string): string {
  const base = siteUrl();
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#F1EFE9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F1EFE9;">
    <tr><td style="background-color:#1a1a1a;height:5px;font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr>
      <td style="padding:40px 20px 0 20px;" align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
          <tr>
            <td align="center" style="padding-bottom:26px;">
              <a href="${base}" style="text-decoration:none;font-size:22px;font-weight:700;color:#1a1a1a;letter-spacing:-0.5px;">Jooma</a>
            </td>
          </tr>
          <tr>
            <td style="background-color:#FAF9F5;border-radius:16px;padding:38px 34px;border:1px solid #DAD8D0;">
              ${content}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:28px 0 40px 0;color:#8a8078;font-size:12px;line-height:1.6;">
              <p style="margin:0;">&copy; ${new Date().getFullYear()} Jooma. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * The only place that talks to SendGrid.
 *
 * Catches and logs; never throws. Every caller here mutates the database first
 * and mails second, so a throw would either roll back a write that genuinely
 * succeeded or leave the caller to hand-wrap each call. A teacher whose invite
 * email bounced can be re-invited; an auth user created and then rolled back
 * because the mail failed is the worse outcome.
 */
async function send(to: string, subject: string, html: string): Promise<boolean> {
  if (!init()) {
    console.warn("[email] SENDGRID_API_KEY not set — skipping send", { to, subject });
    return false;
  }
  const from = process.env.SENDGRID_FROM_EMAIL;
  if (!from) {
    console.warn("[email] SENDGRID_FROM_EMAIL not set — skipping send", { to, subject });
    return false;
  }
  try {
    await sgMail.send({ to, from: { email: from, name: "Jooma" }, subject, html });
    return true;
  } catch (err) {
    console.error("[email] send failed", { to, subject }, err);
    return false;
  }
}

/** Fill {{placeholders}} in an admin-edited subject line. */
function interpolate(template: string, params: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => params[k] ?? "");
}

/**
 * Look up the admin-editable half of a template: its subject override and
 * whether it's live. Missing row = treat as live with the code default, so a
 * new template works before anyone has touched it in /admin/emails.
 */
async function templateSettings(
  key: EmailTemplateKey,
): Promise<{ live: boolean; subject: string | null }> {
  const { data, error } = await supabaseAdmin
    .from("email_templates")
    .select("live, subject")
    .eq("key", key)
    .maybeSingle();
  if (error || !data) return { live: true, subject: null };
  return { live: data.live, subject: data.subject };
}

/** Render a template without sending — powers the /admin/emails preview. */
export function generateEmailHtml(
  key: EmailTemplateKey,
  params: Record<string, string>,
): { subject: string; html: string } | null {
  const render = TEMPLATES[key];
  if (!render) return null;
  const { subject, html } = render(params);
  return { subject, html: layout(html) };
}

/**
 * Render and send. Returns false if the mailer isn't configured, the template
 * is paused in /admin/emails, or delivery failed — callers surface that rather
 * than claiming an email went out.
 */
export async function sendTemplate(
  key: EmailTemplateKey,
  to: string,
  params: Record<string, string>,
): Promise<boolean> {
  const render = TEMPLATES[key];
  if (!render) {
    console.error("[email] unknown template", key);
    return false;
  }

  const settings = await templateSettings(key);
  if (!settings.live) {
    console.warn("[email] template is paused in /admin/emails — not sending", { key, to });
    return false;
  }

  const { subject: defaultSubject, html } = render(params);
  const subject = settings.subject ? interpolate(settings.subject, params) : defaultSubject;
  return send(to, subject, layout(html));
}
