import { escapeHtml, prose, DIVIDER, H1, P, SMALL, type RenderedEmail } from "./shared";

/**
 * Sent when an admin replies to a contact or school enquiry from
 * /admin/enquiries.
 *
 * Two things make this different from supportReply.ts, and both follow from the
 * same fact: the recipient may have no Jooma account.
 *
 *   1. No CTA button and no deep link into the app. A "Reply in Jooma" button
 *      pointing a head teacher at a login screen they have no password for is
 *      worse than no button.
 *
 *   2. It asks them to reply by email, because that is the only channel they
 *      have. /api/enquiries/reply sends this with both From and Reply-To set to
 *      info@jooma.ai, so hitting Reply reaches a mailbox someone reads. The
 *      global SENDGRID_FROM_EMAIL is noreply@, which is right for automated
 *      mail and wrong for this.
 *
 * Internal notes must never reach this function. The gate is in
 * /api/enquiries/reply, which only mails when isNote is false.
 */
export function enquiryReplyTemplate(
  params: Record<string, string>,
  bodyOverride?: string | null,
): RenderedEmail {
  const body = escapeHtml(params.body);
  const name = escapeHtml(params.name);
  const reference = escapeHtml(params.reference);
  const replyTo = escapeHtml(params.replyTo || "info@jooma.ai");

  return {
    subject: "Re: your enquiry about Jooma",
    html: `
    <h1 ${H1}>${name ? `Hello ${name}` : "Thanks for getting in touch"}</h1>
    ${
      // Only the lead-in is overridable. The block below carries what the admin
      // actually wrote, which is the reason this email exists, and must never be
      // replaceable by a template setting.
      prose(bodyOverride) ??
      `<p ${P}>Thanks for your enquiry. Here is our reply:</p>`
    }

    <table cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 8px 0;background-color:#F1ECFC;border-radius:12px;">
      <tr><td style="padding:16px 18px;">
        <p style="margin:0;color:#1D1730;font-size:15px;line-height:1.6;white-space:pre-wrap;">${body}</p>
      </td></tr>
    </table>

    ${DIVIDER}

    <p ${SMALL}>
      Just reply to this email and it comes straight back to us at
      ${replyTo}${reference ? `. Your reference is ${reference}` : ""}.
    </p>
  `,
  };
}
