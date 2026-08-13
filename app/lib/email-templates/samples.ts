// Stand-in values for the /admin/emails preview.
//
// Every name here matches what the real call site passes — see the trigger
// routes listed against each entry — so a preview exercises the same branches
// the live email will. Where a template changes shape depending on a parameter
// (teacher_invite reads differently with and without an inviter name), the
// sample fills it in, because the populated branch is the one that actually
// goes out.
//
// The values are deliberately obvious fakes. An admin looking at a preview
// should never be left wondering whether they are looking at a real teacher's
// details or an email that has already been sent.
import type { EmailTemplateKey } from "./index";

export const SAMPLE_PARAMS: Record<EmailTemplateKey, Record<string, string>> = {
  // app/api/admin/teachers/invite/route.ts
  teacher_invite: {
    inviteUrl: "https://jooma.app/signup?invite=sample-token",
    inviterName: "Sam Okafor",
  },

  // app/api/admin/teachers/reset-password/route.ts
  password_reset: {
    resetUrl: "https://jooma.app/auth/callback?type=recovery&token=sample",
    firstName: "Priya",
  },

  // app/api/admin/teachers/suspend/route.ts — reason is optional in the real
  // send; populated here so the reason block renders and can be reviewed.
  account_suspended: {
    reason: "Repeated sharing of a single login across a department.",
  },

  // app/api/support/reply/route.ts
  support_reply: {
    subject: "Slideshow export is coming out blank",
    body: "Thanks for flagging this — we've pushed a fix. Please try the export again and let us know if it's still blank.",
    reference: "TK-1042",
    threadId: "00000000-0000-0000-0000-000000000000",
  },
};
