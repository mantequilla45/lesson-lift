import { button, escapeHtml, DIVIDER, H1, P, SMALL, type RenderedEmail } from "./shared";

/**
 * Sent when an admin invites a teacher from the Teachers tab.
 *
 * The link is a one-time Supabase invite link (auth.admin.generateLink), so it
 * both proves the address and signs them in — they set a password on arrival
 * rather than being handed one in an email.
 */
export function teacherInviteTemplate(params: Record<string, string>): RenderedEmail {
  const inviteUrl = params.inviteUrl ?? "#";
  const inviter = escapeHtml(params.inviterName);

  return {
    subject: "You have been invited to Jooma",
    html: `
    <h1 ${H1}>You&rsquo;ve been invited to Jooma</h1>
    <p ${P}>
      ${inviter ? `${inviter} has invited you` : "You have been invited"} to Jooma &mdash;
      lesson resources, quizzes and slide decks, generated in seconds and aligned
      to the curriculum.
    </p>
    <p ${P}>Click below to set your password and finish setting up your account.</p>

    ${button("Accept the invite", inviteUrl)}

    ${DIVIDER}

    <p ${SMALL}>
      This link signs you in once and expires, so use it soon. If you weren&rsquo;t
      expecting this invitation you can ignore this email &mdash; no account will
      be set up until you follow the link.
    </p>
  `,
  };
}
