-- Record whether a subscription is set to end at the close of the current
-- period.
--
-- WHY THIS COLUMN IS NEEDED
-- Cancelling through the Stripe Billing Portal does NOT cancel immediately.
-- The portal is configured with subscription_cancel.mode = "at_period_end", so
-- Stripe sets cancel_at_period_end = true and leaves the subscription
-- status = "active" until the paid period actually elapses — that is how the
-- customer keeps the access they have already paid for.
--
-- Without this column the app could not tell "active and renewing" apart from
-- "active but ending", because both report status = "active". The billing page
-- therefore told a cancelling subscriber their plan "Renews on …" and went on
-- offering a Cancel button that Stripe would reject as already-cancelled.
--
-- Nothing here grants or revokes access. The plan still follows
-- subscription_status via the webhook; this flag only drives what the billing
-- page says and which button it shows.
alter table public.profiles
  add column if not exists cancel_at_period_end boolean not null default false;

comment on column public.profiles.cancel_at_period_end is
  'True when the Stripe subscription is set to end at current_period_end. Mirrors Stripe''s cancel_at_period_end; the subscription stays active (and the plan stays paid) until that date.';
