-- ── School mutations ─────────────────────────────────────────────────────────
-- Every function here is volatile, guards on is_admin(), and writes an audit
-- row. Seat arithmetic lives server-side so the client can never be the
-- authority on what a school pays.

-- Default onboarding checklist, applied to every new school.
create or replace function seed_school_tasks(sid uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  insert into school_onboarding_tasks (school_id, key, label, sort)
  values
    (sid, 'contract',  'Contract and DPA signed',            1),
    (sid, 'po',        'Purchase order received',            2),
    (sid, 'admin',     'Admin contact set up',               3),
    (sid, 'invited',   'Teachers invited',                   4),
    (sid, 'signed_in', 'At least half have signed in',       5),
    (sid, 'training',  'Twilight training session delivered', 6)
  on conflict (school_id, key) do nothing;
end;
$$;
revoke execute on function seed_school_tasks(uuid) from anon, public, authenticated;

-- ── Create ───────────────────────────────────────────────────────────────────
-- Takes a jsonb payload so the six-step wizard can submit one object rather
-- than a 25-argument signature that breaks every time a field is added.
create or replace function admin_create_school(payload jsonb)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id       uuid;
  v_seats    integer;
  v_trust_id uuid;
  v_trust    text;
begin
  if not is_admin() then raise exception 'not authorized'; end if;

  if coalesce(payload->>'name', '') = '' then
    raise exception 'school name is required';
  end if;

  v_seats := coalesce((payload->>'seats')::integer, 10);
  if v_seats < 10 then
    -- Below 10 seats individual Pro accounts are better value for the school
    -- and for Jooma; the ladder has no band under 10.
    raise exception 'minimum is 10 seats';
  end if;

  -- Resolve or create the trust by name.
  v_trust := nullif(trim(coalesce(payload->>'trust_name', '')), '');
  if v_trust is not null then
    select id into v_trust_id from trusts where name = v_trust;
    if v_trust_id is null then
      insert into trusts (name) values (v_trust) returning id into v_trust_id;
    end if;
  end if;

  insert into schools (
    name, urn, town, phase, trust_id, seats,
    billing_type, po_number, finance_email, payment_terms, invoice_schedule,
    vat_registered, access_before_payment,
    status, contract_start, renews_at, contract_months, onboarding_fee,
    domain_allowlist, resources_per_seat, ai_images_per_seat,
    contact_name, contact_role, contact_email, contact_phone,
    created_by
  )
  values (
    payload->>'name',
    nullif(payload->>'urn', ''),
    nullif(payload->>'town', ''),
    nullif(payload->>'phase', ''),
    v_trust_id,
    v_seats,
    coalesce(nullif(payload->>'billing_type', ''), 'invoice'),
    nullif(payload->>'po_number', ''),
    nullif(payload->>'finance_email', ''),
    coalesce((payload->>'payment_terms')::integer, 30),
    coalesce(nullif(payload->>'invoice_schedule', ''), 'annual'),
    coalesce((payload->>'vat_registered')::boolean, false),
    coalesce((payload->>'access_before_payment')::boolean, true),
    'pending',
    nullif(payload->>'contract_start', '')::date,
    nullif(payload->>'renews_at', '')::date,
    coalesce((payload->>'contract_months')::integer, 12),
    coalesce((payload->>'onboarding_fee')::numeric, 395),
    nullif(payload->>'domain_allowlist', ''),
    coalesce((payload->>'resources_per_seat')::integer, 300),
    coalesce((payload->>'ai_images_per_seat')::integer, 3),
    nullif(payload->>'contact_name', ''),
    nullif(payload->>'contact_role', ''),
    nullif(payload->>'contact_email', ''),
    nullif(payload->>'contact_phone', ''),
    auth.uid()
  )
  returning id into v_id;

  -- Materialise the seat pool: every contracted seat exists as a `free` row
  -- from day one, so the pool visualisation is honest about what's unused.
  insert into school_seats (school_id, status)
  select v_id, 'free' from generate_series(1, v_seats);

  perform seed_school_tasks(v_id);

  perform admin_log(
    'Created school',
    'account', 'school', v_id::text, payload->>'name',
    jsonb_build_object('seats', v_seats, 'rate', seat_rate(v_seats))
  );

  return v_id;
end;
$$;
revoke execute on function admin_create_school(jsonb) from anon, public;
grant execute on function admin_create_school(jsonb) to authenticated;

-- ── Update details ───────────────────────────────────────────────────────────
create or replace function admin_update_school(sid uuid, payload jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if not is_admin() then raise exception 'not authorized'; end if;

  update schools set
    name             = coalesce(nullif(payload->>'name', ''), name),
    urn              = coalesce(nullif(payload->>'urn', ''), urn),
    town             = coalesce(nullif(payload->>'town', ''), town),
    phase            = coalesce(nullif(payload->>'phase', ''), phase),
    status           = coalesce(nullif(payload->>'status', ''), status),
    billing_type     = coalesce(nullif(payload->>'billing_type', ''), billing_type),
    po_number        = coalesce(nullif(payload->>'po_number', ''), po_number),
    finance_email    = coalesce(nullif(payload->>'finance_email', ''), finance_email),
    payment_terms    = coalesce((payload->>'payment_terms')::integer, payment_terms),
    invoice_schedule = coalesce(nullif(payload->>'invoice_schedule', ''), invoice_schedule),
    vat_registered   = coalesce((payload->>'vat_registered')::boolean, vat_registered),
    renews_at        = coalesce(nullif(payload->>'renews_at', '')::date, renews_at),
    dpa_signed_at    = coalesce(nullif(payload->>'dpa_signed_at', '')::timestamptz, dpa_signed_at),
    domain_allowlist = coalesce(nullif(payload->>'domain_allowlist', ''), domain_allowlist),
    contact_name     = coalesce(nullif(payload->>'contact_name', ''), contact_name),
    contact_role     = coalesce(nullif(payload->>'contact_role', ''), contact_role),
    contact_email    = coalesce(nullif(payload->>'contact_email', ''), contact_email),
    contact_phone    = coalesce(nullif(payload->>'contact_phone', ''), contact_phone),
    notes            = coalesce(payload->>'notes', notes),
    updated_at       = now()
  where id = sid
  returning name into v_name;

  if v_name is null then raise exception 'no such school'; end if;

  perform admin_log('Updated school', 'account', 'school', sid::text, v_name, payload);
end;
$$;
revoke execute on function admin_update_school(uuid, jsonb) from anon, public;
grant execute on function admin_update_school(uuid, jsonb) to authenticated;

-- ── Change seat count ────────────────────────────────────────────────────────
-- Adds `free` rows when growing. When shrinking, only unoccupied seats are
-- removed — a teacher never silently loses access because someone typed a
-- smaller number.
create or replace function admin_update_seats(sid uuid, n integer)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_name     text;
  v_current  integer;
  v_occupied integer;
  v_remove   integer;
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  if n < 10 then raise exception 'minimum is 10 seats'; end if;

  select name, seats into v_name, v_current from schools where id = sid;
  if v_name is null then raise exception 'no such school'; end if;

  if n > v_current then
    insert into school_seats (school_id, status)
    select sid, 'free' from generate_series(1, n - v_current);

  elsif n < v_current then
    -- The constraint is that occupied seats must still fit. Comparing the free
    -- count against the number being removed is NOT equivalent: dropping 20->10
    -- with 18 free and 2 invited passes that check but would leave 10 seats
    -- holding 2 invitees and only 8 spare, silently under-counting the pool.
    select count(*) into v_occupied
      from school_seats
     where school_id = sid and status <> 'free';

    if n < v_occupied then
      raise exception
        'cannot drop to % seats: % seat(s) are assigned or invited. Reclaim seats first.',
        n, v_occupied;
    end if;

    v_remove := v_current - n;
    delete from school_seats
    where id in (
      select id from school_seats
      where school_id = sid and status = 'free'
      limit v_remove
    );
  end if;

  update schools set seats = n, updated_at = now() where id = sid;

  perform admin_log(
    'Changed seat count',
    'billing', 'school', sid::text, v_name,
    jsonb_build_object(
      'from', v_current, 'to', n,
      'old_rate', seat_rate(v_current), 'new_rate', seat_rate(n)
    )
  );
end;
$$;
revoke execute on function admin_update_seats(uuid, integer) from anon, public;
grant execute on function admin_update_seats(uuid, integer) to authenticated;

-- ── Invite teachers ──────────────────────────────────────────────────────────
-- Claims a free seat per email. Returns how many were actually invited so the
-- UI can report "3 of 5 sent — you're out of seats" rather than failing whole.
create or replace function admin_invite_teachers(sid uuid, emails text[])
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_name  text;
  v_email text;
  v_seat  uuid;
  v_count integer := 0;
begin
  if not is_admin() then raise exception 'not authorized'; end if;

  select name into v_name from schools where id = sid;
  if v_name is null then raise exception 'no such school'; end if;

  foreach v_email in array emails loop
    v_email := lower(trim(v_email));
    continue when v_email = '' or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$';

    -- Idempotent: re-inviting an existing invitee is a no-op rather than a
    -- second seat.
    if exists (
      select 1 from school_seats
      where school_id = sid and lower(invited_email) = v_email
    ) then
      continue;
    end if;

    select id into v_seat from school_seats
      where school_id = sid and status = 'free'
      limit 1;
    exit when v_seat is null;   -- out of seats

    update school_seats
       set status = 'invited', invited_email = v_email, invited_at = now()
     where id = v_seat;

    v_seat := null;
    v_count := v_count + 1;
  end loop;

  if v_count > 0 then
    perform admin_log(
      'Invited ' || v_count || ' teacher(s)',
      'account', 'school', sid::text, v_name,
      jsonb_build_object('invited', v_count, 'requested', array_length(emails, 1))
    );
  end if;

  return v_count;
end;
$$;
revoke execute on function admin_invite_teachers(uuid, text[]) from anon, public;
grant execute on function admin_invite_teachers(uuid, text[]) to authenticated;

-- ── Reclaim a seat ───────────────────────────────────────────────────────────
-- Frees the seat and unlinks the teacher. Deliberately does NOT touch their
-- resources: their work stays theirs, they just lose school access.
create or replace function admin_reclaim_seat(seat_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_school   uuid;
  v_name     text;
  v_user     uuid;
  v_label    text;
begin
  if not is_admin() then raise exception 'not authorized'; end if;

  select school_id, user_id, coalesce(invited_email, '')
    into v_school, v_user, v_label
  from school_seats where id = seat_id;

  if v_school is null then raise exception 'no such seat'; end if;

  if v_user is not null then
    select coalesce(u.email::text, '') into v_label from auth.users u where u.id = v_user;
    update profiles set school_id = null where id = v_user;
  end if;

  update school_seats
     set status = 'free', user_id = null, invited_email = null,
         invited_at = null, accepted_at = null
   where id = seat_id;

  select name into v_name from schools where id = v_school;

  perform admin_log(
    'Reclaimed a seat', 'account', 'school', v_school::text, v_name,
    jsonb_build_object('freed_from', v_label)
  );
end;
$$;
revoke execute on function admin_reclaim_seat(uuid) from anon, public;
grant execute on function admin_reclaim_seat(uuid) to authenticated;

-- ── Move pooled capacity to one teacher ──────────────────────────────────────
-- The school pool is shared, but a specific teacher can be given headroom. This
-- is an allowance grant tagged as a pool transfer, so it shows in both the
-- teacher's meter and the audit log.
create or replace function admin_move_capacity(
  sid uuid, uid uuid, p_kind text, p_amount integer
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if not is_admin() then raise exception 'not authorized'; end if;

  if not exists (select 1 from profiles where id = uid and school_id = sid) then
    raise exception 'that teacher is not on this school plan';
  end if;

  select name into v_name from schools where id = sid;

  return admin_grant_allowance(uid, p_kind, p_amount, 'School pool transfer — ' || v_name);
end;
$$;
revoke execute on function admin_move_capacity(uuid, uuid, text, integer) from anon, public;
grant execute on function admin_move_capacity(uuid, uuid, text, integer) to authenticated;

-- ── Trust list, for filters and the wizard ───────────────────────────────────
create or replace function admin_trusts()
returns table (id uuid, name text, schools bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    select t.id, t.name, count(s.id)
    from trusts t
    left join schools s on s.trust_id = t.id
    group by t.id, t.name
    order by t.name;
end;
$$;
revoke execute on function admin_trusts() from anon, public;
grant execute on function admin_trusts() to authenticated;
