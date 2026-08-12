-- Make the USD→GBP rate a single source of truth.
--
-- The rate lived in two places that had to be edited together by hand:
-- fx_usd_to_gbp() here and FX_USD_TO_GBP in app/admin/format.ts. Nothing
-- enforced that they agreed, so updating one and forgetting the other would
-- silently give the enforcement gate and the admin console different ideas of
-- what a teacher had spent — with no error to notice.
--
-- This makes the database authoritative and gives the app a way to read the
-- rate rather than restate it.
--
-- WHY THE RATE IS STILL A CONSTANT, NOT A LIVE FEED:
-- fx_usd_to_gbp() is `immutable` so Postgres can inline it inside
-- monthly_ai_spend(), which runs on every cost-bearing request. A live rate
-- would also make historical figures move every time a report was re-run — last
-- month's margin should not change because the pound moved today. Providers
-- bill in USD, but Jooma charges in GBP through Stripe, so drift affects cost
-- reporting and the spend ceiling slightly, never what anyone is charged.
-- Review quarterly; the settings row below records when it was last done.

create table if not exists fx_rate (
  -- Single-row table. The check constraint is what keeps it that way.
  id          boolean primary key default true check (id),
  usd_to_gbp  numeric(10,4) not null check (usd_to_gbp > 0 and usd_to_gbp < 10),
  -- When a human last checked this against a real rate, so staleness is
  -- visible rather than silent.
  reviewed_at date not null default current_date,
  note        text,
  updated_by  uuid references auth.users(id) on delete set null,
  updated_at  timestamptz not null default now()
);

insert into fx_rate (id, usd_to_gbp, reviewed_at, note)
values (true, 0.79, date '2026-08-01', 'Initial rate, carried over from the Aug 2026 cost sheet.')
on conflict (id) do nothing;

alter table fx_rate enable row level security;

-- Readable by anyone signed in: the app needs it to render cost figures, and a
-- exchange rate is not sensitive. Writes are admin-only.
drop policy if exists "fx rate readable" on fx_rate;
create policy "fx rate readable" on fx_rate for select using (true);

drop policy if exists "admins write fx rate" on fx_rate;
create policy "admins write fx rate" on fx_rate
  for all using (is_admin()) with check (is_admin());

-- The function keeps its name and signature so every existing caller keeps
-- working, but now reads the table instead of hardcoding the number.
--
-- Deliberately STABLE rather than IMMUTABLE: it reads a table, and lying about
-- that would let Postgres cache a stale value across a rate change within the
-- same statement. Still inlines fine inside monthly_ai_spend().
create or replace function fx_usd_to_gbp()
returns numeric
language sql
stable
parallel safe
security definer
set search_path = public
as $$
  -- Falls back to the historical constant if the row is ever missing, so a
  -- cost query can never return null and silently zero out someone's spend.
  select coalesce((select usd_to_gbp from fx_rate where id), 0.79::numeric)
$$;

grant execute on function fx_usd_to_gbp() to authenticated;

comment on function fx_usd_to_gbp() is
  'USD -> GBP, read from the fx_rate table. THE single source of truth: the app reads this via admin_fx_rate() rather than keeping its own copy. Costs are logged in USD because providers bill in USD; Jooma charges GBP through Stripe, so this affects cost reporting and the spend ceiling only, never what a customer is charged.';

-- Lets the app read the rate (and how stale it is) without a service-role trip.
create or replace function admin_fx_rate()
returns table (usd_to_gbp numeric, reviewed_at date, note text)
language sql stable security definer set search_path = public
as $$
  select f.usd_to_gbp, f.reviewed_at, f.note from fx_rate f where f.id
$$;

grant execute on function admin_fx_rate() to authenticated;

create or replace function admin_set_fx_rate(p_rate numeric, p_note text default null)
returns void
language plpgsql volatile security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;

  -- A fat-fingered rate would quietly distort every cost figure and the spend
  -- ceiling, so bound it to something a real GBP/USD rate could plausibly be.
  if p_rate is null or p_rate <= 0.4 or p_rate >= 2.0 then
    raise exception 'FX rate % is not plausible for USD->GBP', p_rate;
  end if;

  update fx_rate
     set usd_to_gbp = p_rate,
         note        = coalesce(p_note, note),
         reviewed_at = current_date,
         updated_by  = auth.uid(),
         updated_at  = now()
   where id;

  perform admin_log('Updated the USD to GBP rate', 'billing', 'fx_rate', 'fx',
                    p_rate::text, jsonb_build_object('usd_to_gbp', p_rate, 'note', p_note));
end;
$$;

revoke execute on function admin_set_fx_rate(numeric, text) from anon, public;
grant execute on function admin_set_fx_rate(numeric, text) to authenticated;
