import { button, escapeHtml, DIVIDER, H1, P, SMALL, type RenderedEmail } from "./shared";

/**
 * Sent when an admin triggers a password reset from the Teachers drawer.
 *
 * Worth being explicit in the copy that a person did this: a reset email the
 * recipient didn't request reads as a breach attempt otherwise.
 */
export function passwordResetTemplate(params: Record<string, string>): RenderedEmail {
  const resetUrl = params.resetUrl ?? "#";
  const firstName = escapeHtml(params.firstName);

  return {
    subject: "Reset your Jooma password",
    html: `
    <h1 ${H1}>Reset your password</h1>
    <p ${P}>
      ${firstName ? `Hi ${firstName} &mdash; s` : "S"}omeone on the Jooma team started
      a password reset for your account, usually because you asked us to. Click
      below to choose a new password.
    </p>

    ${button("Choose a new password", resetUrl)}

    ${DIVIDER}

    <p ${SMALL}>
      This link expires shortly and can only be used once. If you didn&rsquo;t ask
      for a reset you can ignore this email &mdash; your current password will keep
      working and nothing has changed.
    </p>
  `,
  };
}
