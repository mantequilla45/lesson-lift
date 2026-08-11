import { escapeHtml, DIVIDER, H1, P, SMALL, type RenderedEmail } from "./shared";
import { siteUrl } from "./shared";

/**
 * Only sent when the admin ticks "email them" while suspending — a suspension
 * is sometimes an internal action (a duplicate account, a billing hold) where
 * mailing the teacher would be noise or worse.
 *
 * No CTA button: there is nothing useful for them to click while suspended.
 * Reply-to support is the only route back, and the reason is included when the
 * admin gave one, since "your account is suspended" with no explanation is a
 * support ticket by design.
 */
export function accountSuspendedTemplate(params: Record<string, string>): RenderedEmail {
  const reason = escapeHtml(params.reason);
  const base = siteUrl();

  return {
    subject: "Your Jooma account has been suspended",
    html: `
    <h1 ${H1}>Your account has been suspended</h1>
    <p ${P}>
      Your Jooma account has been suspended, so you won&rsquo;t be able to sign in
      for now. Your saved resources have not been deleted.
    </p>
    ${
      reason
        ? `<table cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 16px 0;background-color:#F1EFE9;border-radius:12px;">
             <tr><td style="padding:14px 16px;">
               <p style="margin:0 0 4px 0;color:#8a8078;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;">Reason</p>
               <p style="margin:0;color:#1a1a1a;font-size:14px;line-height:1.6;white-space:pre-wrap;">${reason}</p>
             </td></tr>
           </table>`
        : ""
    }

    ${DIVIDER}

    <p ${SMALL}>
      If you think this is a mistake, reply to this email and our team will take
      another look. You can also reach us from
      <a href="${base}" style="color:#1a1a1a;font-weight:500;">jooma.app</a>.
    </p>
  `,
  };
}
