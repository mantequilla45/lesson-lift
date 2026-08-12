import { button, escapeHtml, DIVIDER, H1, P, SMALL, type RenderedEmail } from "./shared";

/**
 * Sent when an admin invites a teacher from the Teachers tab.
 *
 * The link carries an invite token to /signup, where they choose how to sign in
 * — Google or a password. The token is matched to their address when they
 * finish onboarding; it is not itself a sign-in, so it never grants access on
 * its own.
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
    <p ${P}>
      Click below to set up your account. You can continue with Google or create a
      password &mdash; whichever you prefer.
    </p>

    ${button("Accept the invite", inviteUrl)}

    ${DIVIDER}

    <p ${SMALL}>
      This invitation expires in 7 days. If you weren&rsquo;t expecting it you can
      ignore this email &mdash; no account will be set up until you follow the link.
    </p>
  `,
  };
}
