// Helpers the individual templates need. These live here rather than in
// email.ts so a template can import them without a circular import back through
// the registry that email.ts itself imports.
import "server-only";

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://jooma.app").replace(/\/$/, "");
}

/** Escape before interpolating anything user-supplied into email HTML. */
export function escapeHtml(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Bulletproof-ish CTA button, in the Jooma palette. */
export function button(text: string, href: string): string {
  return `
<table cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr>
    <td style="background-color:#1a1a1a;border-radius:12px;padding:13px 30px;">
      <a href="${href}" style="color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;display:inline-block;">${text}</a>
    </td>
  </tr>
</table>`;
}

export const H1 = 'style="margin:0 0 10px 0;font-size:22px;font-weight:700;color:#1a1a1a;"';
export const P = 'style="margin:0 0 16px 0;color:#6b6055;font-size:15px;line-height:1.6;"';
export const SMALL = 'style="margin:0;color:#8a8078;font-size:13px;line-height:1.6;"';
export const DIVIDER = `
<table cellpadding="0" cellspacing="0" style="width:100%;margin:8px 0 18px 0;">
  <tr><td style="border-top:1px solid #DAD8D0;font-size:0;line-height:0;height:1px;">&nbsp;</td></tr>
</table>`;

/** Every template renders to this shape. */
export interface RenderedEmail {
  subject: string;
  html: string;
}
