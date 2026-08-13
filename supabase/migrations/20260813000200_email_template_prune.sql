-- ── Email templates: delete what cannot send, clear the body column ──────────
-- /admin/emails listed fifteen templates. Four of them send. The other eleven
-- have no renderer in app/lib/email-templates and nothing anywhere that would
-- trigger them, so their live toggle did nothing and their wording went
-- nowhere. A page that presents eleven fictional emails beside four real ones
-- teaches an admin to distrust all fifteen.
--
-- Eight are deleted outright. Three are kept because the feature that would
-- send them is plausibly next and the drafted subject lines are worth having;
-- their trigger_description now says so in plain words rather than describing
-- a trigger that does not exist.

-- ── The body column ──────────────────────────────────────────────────────────
-- This has to happen before app/lib/email.ts starts reading body, and it is the
-- reason this migration is separate from the code change rather than bundled
-- with it.
--
-- body was only ever written by /admin/emails, and whoever seeded these two
-- rows used it as a notes field — a description of when the email fires, aimed
-- at a colleague reading the admin panel. sendTemplate ignored body entirely,
-- so that was harmless.
--
-- It stops being harmless the moment body renders inside the email. Left as it
-- is, the next teacher invited to Jooma receives an email whose entire body
-- reads "Sent with a one-time link that lets the teacher set their own
-- password." — an internal note, mailed to a customer, in place of the
-- invitation.
--
-- Cleared rather than migrated into prose: an empty body means "use the wording
-- in the code", which is the correct behaviour for both of these.
update email_templates
   set body = null
 where key in ('teacher_invite', 'account_suspended');

-- ── Templates that cannot send ───────────────────────────────────────────────
delete from email_templates where key in (
  -- Supabase Auth sends the signup confirmation itself, from a template stored
  -- in the Supabase dashboard. Editing this row changed nothing, and keeping it
  -- implies a control over that email which this panel does not have.
  'verify_email',

  -- Both school emails: there are no schools. plan_config has school at
  -- status='draft', the schools and school_seats tables are empty, and seats,
  -- pooled allowances and central billing are unimplemented.
  'school_invite',
  'school_welcome',

  -- Would fire at 80% of a monthly allowance. No such threshold is computed
  -- anywhere, and Pro is fair-use rather than a monthly count.
  'resources_low',

  -- Dunning. The Stripe webhook records subscription state but sends nothing,
  -- and there is no scheduled job to walk a failed payment through three
  -- escalating emails over seven days.
  'payment_failed_1',
  'payment_failed_2',
  'payment_failed_3',

  -- Needs a job that finds teachers inactive for fourteen days. There is none.
  'we_miss_you'
);

-- ── Templates kept, but honest about having no trigger ───────────────────────
-- These three describe behaviour we intend to build. Until then the admin panel
-- should say that plainly instead of implying an email goes out.
update email_templates
   set trigger_description = 'Nothing sends this yet — signup does not trigger an email. Wording is saved for when it does.'
 where key = 'welcome';

update email_templates
   set trigger_description = 'Nothing sends this yet — running out shows an in-app prompt instead. Wording is saved for when it does.'
 where key = 'resources_out';

update email_templates
   set trigger_description = 'Nothing sends this yet — AI image limits are not emailed. Wording is saved for when it does.'
 where key = 'ai_images_out';

-- ── Ordering ─────────────────────────────────────────────────────────────────
-- The four that genuinely send come first, in roughly the order a teacher meets
-- them; the three parked ones sit below a visible gap in the sort values.
update email_templates set sort =  1 where key = 'teacher_invite';
update email_templates set sort =  2 where key = 'password_reset';
update email_templates set sort =  3 where key = 'account_suspended';
update email_templates set sort =  4 where key = 'support_reply';
update email_templates set sort = 20 where key = 'welcome';
update email_templates set sort = 21 where key = 'resources_out';
update email_templates set sort = 22 where key = 'ai_images_out';
