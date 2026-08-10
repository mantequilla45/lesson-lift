-- Adds the Max plan (see app/lib/plans.ts) to the set of plans a profile can
-- hold. The original check constraint only allowed free/pro/school.
alter table profiles drop constraint if exists profiles_plan_check;

alter table profiles
  add constraint profiles_plan_check check (plan in ('free', 'pro', 'max', 'school'));
