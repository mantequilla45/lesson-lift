// ── Transactional email ──────────────────────────────────────────────────────
// SendGrid over its HTTP API. Supabase's built-in auth mailer is deliberately
// not used: its templates live in the Supabase dashboard rather than this repo,
// which would leave /admin/emails decorative, and its send rate limits bite on
// a bulk invite. Supabase still mints the auth tokens (generateLink), so no
// token or session logic lives here — only delivery.
//
// Subject lines, the live/paused switch and the body prose come from the
// email_templates table so an admin can reword or pause an email without a
// deploy. The *structure* stays in code: layout(), the CTA buttons, the reason
// and reply blocks, the security footnotes and every bit of escaping. An admin
// edits sentences, and the override runs through prose() in email-templates/
// shared.ts, which escapes before it wraps — so nothing typed into that
// textarea can inject markup into a teacher's inbox or break the email.
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
<body style="margin:0;padding:0;background-color:#F7F5FC;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7F5FC;">
    <tr><td style="background-color:#5B2ED6;height:5px;font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr>
      <td style="padding:40px 20px 0 20px;" align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
          <tr>
            <td align="center" style="padding-bottom:26px;">
              <a href="${base}" style="text-decoration:none;font-size:22px;font-weight:800;color:#5B2ED6;letter-spacing:-0.5px;">Jooma</a>
            </td>
          </tr>
          <tr>
            <td style="background-color:#FFFFFF;border-radius:16px;padding:38px 34px;border:1px solid #EAE6F5;">
              ${content}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:28px 0 40px 0;color:#6D6683;font-size:12px;line-height:1.6;">
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

/**
 * Fill {{placeholders}} in admin-edited wording. Double braces, not single —
 * /admin/emails shows the available names per template.
 *
 * Exported so the admin preview route renders through exactly this function
 * rather than its own copy of the regex; a preview that interpolates
 * differently from the sender is worse than no preview.
 */
export function interpolate(template: string, params: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => params[k] ?? "");
}

/**
 * Look up the admin-editable half of a template: its subject override and
 * whether it's live. Missing row = treat as live with the code default, so a
 * new template works before anyone has touched it in /admin/emails.
 */
async function templateSettings(
  key: EmailTemplateKey,
): Promise<{ live: boolean; subject: string | null; body: string | null }> {
  const { data, error } = await supabaseAdmin
    .from("email_templates")
    .select("live, subject, body")
    .eq("key", key)
    .maybeSingle();
  if (error || !data) return { live: true, subject: null, body: null };
  return { live: data.live, subject: data.subject, body: data.body };
}

/**
 * Render a template without sending — powers the /admin/emails preview.
 *
 * `bodyOverride` is passed in rather than read from the database so the preview
 * can show wording the admin is still typing, before they save it.
 */
export function generateEmailHtml(
  key: EmailTemplateKey,
  params: Record<string, string>,
  bodyOverride?: string | null,
): { subject: string; html: string } | null {
  const render = TEMPLATES[key];
  if (!render) return null;
  const override = bodyOverride ? interpolate(bodyOverride, params) : null;
  const { subject, html } = render(params, override);
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

  // Interpolate the override before it reaches the template, so {{firstName}}
  // works in a body exactly as it does in a subject. prose() escapes afterwards,
  // so a parameter carrying markup still cannot inject any.
  const override = settings.body ? interpolate(settings.body, params) : null;

  const { subject: defaultSubject, html } = render(params, override);
  const subject = settings.subject ? interpolate(settings.subject, params) : defaultSubject;
  return send(to, subject, layout(html));
}
