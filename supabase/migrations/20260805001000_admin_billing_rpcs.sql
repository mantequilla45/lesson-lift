-- ── Billing RPCs ─────────────────────────────────────────────────────────────

-- Payments & invoices list, with the payer resolved from either the school or
-- the individual teacher.
create or replace function admin_invoices()
returns table (
  id             uuid,
  reference      text,
  payer          text,
  type           text,
  amount_gbp     numeric,
  status         text,
  due_at         date,
  paid_at        timestamptz,
  method         text,
  po_number      text,
  attempt_count  integer,
  failure_reason text,
  school_id      uuid,
  user_id        uuid,
  created_at     timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    select
      i.id,
      i.reference,
      coalesce(
        sc.name,
        nullif(trim(coalesce(p.first_name,'') || ' ' || coalesce(p.surname,'')), ''),
        u.email::text,
        '—'
      ),
      i.type,
      i.amount_gbp,
      -- Derived overdue: a sent invoice past its due date reads as overdue
      -- without needing a nightly job to flip the column.
      case
        when i.status = 'sent' and i.due_at is not null and i.due_at < current_date
        then 'overdue' else i.status
      end,
      i.due_at, i.paid_at, i.method, i.po_number,
      i.attempt_count, i.failure_reason,
      i.school_id, i.user_id, i.created_at
    from invoices i
    left join schools sc   on sc.id = i.school_id
    left join auth.users u on u.id = i.user_id
    left join profiles p   on p.id = i.user_id
    order by i.created_at desc;
end;
$$;
revoke execute on function admin_invoices() from anon, public;
grant execute on function admin_invoices() to authenticated;

-- Headline billing figures for the stat row.
create or replace function admin_billing_summary()
returns table (
  collected_this_month numeric,
  outstanding          numeric,
  overdue_count        bigint,
  failed_count         bigint,
  failed_value         numeric,
  refunded_this_month  numeric
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    select
      coalesce(sum(i.amount_gbp) filter (
        where i.status = 'paid' and i.paid_at >= date_trunc('month', now())), 0),
      coalesce(sum(i.amount_gbp) filter (where i.status in ('sent','overdue')), 0),
      count(*) filter (
        where i.status = 'overdue'
           or (i.status = 'sent' and i.due_at is not null and i.due_at < current_date)),
      count(*) filter (where i.status = 'failed'),
      coalesce(sum(i.amount_gbp) filter (where i.status = 'failed'), 0),
      coalesce(sum(i.amount_gbp) filter (
        where i.status = 'refunded' and i.updated_at >= date_trunc('month', now())), 0)
    from invoices i;
end;
$$;
revoke execute on function admin_billing_summary() from anon, public;
grant execute on function admin_billing_summary() to authenticated;

-- Raise a school invoice. Reference is allocated server-side so two admins
-- can't mint the same number.
create or replace function admin_create_invoice(
  p_school_id uuid,
  p_amount    numeric default null,
  p_due_at    date default null,
  p_method    text default null
)
returns uuid
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_id     uuid;
  v_ref    text;
  v_name   text;
  v_seats  integer;
  v_rate   numeric;
  v_amount numeric;
  v_po     text;
  v_terms  integer;
begin
  if not is_admin() then raise exception 'not authorized'; end if;

  select name, seats, po_number, payment_terms
    into v_name, v_seats, v_po, v_terms
  from schools where id = p_school_id;
  if v_name is null then raise exception 'no such school'; end if;

  v_rate := seat_rate(v_seats);
  -- Default to a full year of seats at the banded rate.
  v_amount := coalesce(p_amount, v_seats * v_rate * 12);

  v_ref := 'INV-' || to_char(now(), 'YYYY') || '-' ||
           lpad((
             select coalesce(count(*), 0) + 1
             from invoices
             where created_at >= date_trunc('year', now())
           )::text, 4, '0');

  insert into invoices (
    reference, school_id, type, amount_gbp, status, due_at, method, po_number
  )
  values (
    v_ref, p_school_id, 'school', v_amount, 'draft',
    coalesce(p_due_at, current_date + coalesce(v_terms, 30)),
    coalesce(p_method, 'BACS · ' || v_seats || ' seats @ ' || to_char(v_rate, 'FM999990.00')),
    v_po
  )
  returning id into v_id;

  perform admin_log('Raised invoice', 'billing', 'invoice', v_id::text, v_ref,
    jsonb_build_object('school', v_name, 'amount_gbp', v_amount));

  return v_id;
end;
$$;
revoke execute on function admin_create_invoice(uuid, numeric, date, text) from anon, public;
grant execute on function admin_create_invoice(uuid, numeric, date, text) to authenticated;

create or replace function admin_set_invoice_status(inv_id uuid, p_status text)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare v_ref text;
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  if p_status not in ('draft','sent','paid','overdue','failed','refunded','void') then
    raise exception 'invalid status';
  end if;

  update invoices
     set status = p_status,
         paid_at = case when p_status = 'paid' then coalesce(paid_at, now()) else paid_at end,
         updated_at = now()
   where id = inv_id
  returning reference into v_ref;

  if v_ref is null then raise exception 'no such invoice'; end if;

  perform admin_log('Marked invoice ' || p_status, 'billing', 'invoice', inv_id::text, v_ref,
    jsonb_build_object('status', p_status));
end;
$$;
revoke execute on function admin_set_invoice_status(uuid, text) from anon, public;
grant execute on function admin_set_invoice_status(uuid, text) to authenticated;

-- ── Top-ups ──────────────────────────────────────────────────────────────────
create or replace function admin_topup_packs()
returns table (
  id uuid, kind text, name text, price_gbp numeric, unit integer,
  available_to text[], active boolean, sold bigint, revenue_gbp numeric
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    select t.id, t.kind, t.name, t.price_gbp, t.unit, t.available_to, t.active,
           count(pu.id), coalesce(sum(pu.price_gbp), 0)
    from topup_packs t
    left join topup_purchases pu on pu.pack_id = t.id
    group by t.id
    order by t.sort;
end;
$$;
revoke execute on function admin_topup_packs() from anon, public;
grant execute on function admin_topup_packs() to authenticated;

create or replace function admin_upsert_topup_pack(payload jsonb)
returns uuid
language plpgsql volatile security definer set search_path = public
as $$
declare v_id uuid;
begin
  if not is_admin() then raise exception 'not authorized'; end if;

  v_id := nullif(payload->>'id', '')::uuid;

  if v_id is null then
    insert into topup_packs (kind, name, price_gbp, unit, available_to, active, sort)
    values (
      payload->>'kind', payload->>'name',
      (payload->>'price_gbp')::numeric, (payload->>'unit')::integer,
      coalesce(
        (select array_agg(value::text) from jsonb_array_elements_text(payload->'available_to')),
        array['free','pro','max']::text[]
      ),
      coalesce((payload->>'active')::boolean, true),
      coalesce((payload->>'sort')::integer, 99)
    )
    returning id into v_id;
    perform admin_log('Created top-up pack', 'billing', 'topup_pack', v_id::text, payload->>'name', payload);
  else
    update topup_packs set
      name      = coalesce(nullif(payload->>'name', ''), name),
      price_gbp = coalesce((payload->>'price_gbp')::numeric, price_gbp),
      unit      = coalesce((payload->>'unit')::integer, unit),
      active    = coalesce((payload->>'active')::boolean, active)
    where id = v_id;
    perform admin_log('Updated top-up pack', 'billing', 'topup_pack', v_id::text, payload->>'name', payload);
  end if;

  return v_id;
end;
$$;
revoke execute on function admin_upsert_topup_pack(jsonb) from anon, public;
grant execute on function admin_upsert_topup_pack(jsonb) to authenticated;

create or replace function admin_topup_summary()
returns table (
  sold_total bigint, sold_this_month bigint,
  revenue_total numeric, revenue_this_month numeric,
  ai_packs bigint, repeat_buyers bigint
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    select
      count(*),
      count(*) filter (where p.created_at >= date_trunc('month', now())),
      coalesce(sum(p.price_gbp), 0),
      coalesce(sum(p.price_gbp) filter (where p.created_at >= date_trunc('month', now())), 0),
      count(*) filter (where p.kind = 'ai_image'),
      (select count(*) from (
        select pu.user_id from topup_purchases pu group by pu.user_id having count(*) > 1
      ) r)
    from topup_purchases p;
end;
$$;
revoke execute on function admin_topup_summary() from anon, public;
grant execute on function admin_topup_summary() to authenticated;

-- ── Plans ────────────────────────────────────────────────────────────────────
create or replace function admin_plans()
returns table (
  plan_id text, name text, audience text,
  price_monthly numeric, price_yearly numeric,
  monthly_resources integer, ai_image_slideshows integer,
  description text, status text, users bigint
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    select c.plan_id, c.name, c.audience, c.price_monthly, c.price_yearly,
           c.monthly_resources, c.ai_image_slideshows, c.description, c.status,
           count(p.id)
    from plan_config c
    left join profiles p on coalesce(p.plan, 'free') = c.plan_id
    group by c.plan_id, c.name, c.audience, c.price_monthly, c.price_yearly,
             c.monthly_resources, c.ai_image_slideshows, c.description, c.status, c.sort
    order by c.sort;
end;
$$;
revoke execute on function admin_plans() from anon, public;
grant execute on function admin_plans() to authenticated;

create or replace function admin_update_plan(p_plan_id text, payload jsonb)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare v_name text;
begin
  if not is_admin() then raise exception 'not authorized'; end if;

  update plan_config set
    name                = coalesce(nullif(payload->>'name', ''), name),
    price_monthly       = coalesce((payload->>'price_monthly')::numeric, price_monthly),
    price_yearly        = coalesce((payload->>'price_yearly')::numeric, price_yearly),
    monthly_resources   = coalesce((payload->>'monthly_resources')::integer, monthly_resources),
    ai_image_slideshows = coalesce((payload->>'ai_image_slideshows')::integer, ai_image_slideshows),
    description         = coalesce(nullif(payload->>'description', ''), description),
    status              = coalesce(nullif(payload->>'status', ''), status),
    updated_by          = auth.uid(),
    updated_at          = now()
  where plan_id = p_plan_id
  returning name into v_name;

  if v_name is null then raise exception 'no such plan'; end if;

  -- Deliberately does NOT touch Stripe. Changing a price here changes what the
  -- console and pricing page display; the Stripe Price objects are immutable
  -- and must be re-created there, then their IDs pasted into the env vars.
  perform admin_log('Updated plan', 'billing', 'plan', p_plan_id, v_name, payload);
end;
$$;
revoke execute on function admin_update_plan(text, jsonb) from anon, public;
grant execute on function admin_update_plan(text, jsonb) to authenticated;

-- ── Pricing rules ────────────────────────────────────────────────────────────
create or replace function admin_pricing_rules()
returns table (key text, label text, description text, enabled boolean, sort integer)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    select r.key, r.label, r.description, r.enabled, r.sort
    from pricing_rules r order by r.sort;
end;
$$;
revoke execute on function admin_pricing_rules() from anon, public;
grant execute on function admin_pricing_rules() to authenticated;

create or replace function admin_set_pricing_rule(p_key text, p_enabled boolean)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare v_label text;
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  update pricing_rules
     set enabled = p_enabled, updated_by = auth.uid(), updated_at = now()
   where key = p_key
  returning label into v_label;
  if v_label is null then raise exception 'no such rule'; end if;
  perform admin_log(
    case when p_enabled then 'Enabled pricing rule' else 'Disabled pricing rule' end,
    'billing', 'pricing_rule', p_key, v_label, jsonb_build_object('enabled', p_enabled));
end;
$$;
revoke execute on function admin_set_pricing_rule(text, boolean) from anon, public;
grant execute on function admin_set_pricing_rule(text, boolean) to authenticated;

-- ── Promo codes ──────────────────────────────────────────────────────────────
create or replace function admin_promo_codes()
returns table (
  id uuid, code text, offer text, channel text,
  redeemed integer, revenue_gbp numeric, expires_at date, status text
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    select p.id, p.code, p.offer, p.channel, p.redeemed, p.revenue_gbp,
           p.expires_at,
           case when p.expires_at is not null and p.expires_at < current_date
                then 'expired' else p.status end
    from promo_codes p
    order by p.created_at desc;
end;
$$;
revoke execute on function admin_promo_codes() from anon, public;
grant execute on function admin_promo_codes() to authenticated;

create or replace function admin_upsert_promo(payload jsonb)
returns uuid
language plpgsql volatile security definer set search_path = public
as $$
declare v_id uuid; v_code text;
begin
  if not is_admin() then raise exception 'not authorized'; end if;

  v_id := nullif(payload->>'id', '')::uuid;
  v_code := upper(trim(coalesce(payload->>'code', '')));
  if v_code = '' then raise exception 'code is required'; end if;

  if v_id is null then
    insert into promo_codes (code, offer, channel, expires_at, status)
    values (
      v_code, coalesce(payload->>'offer', ''), nullif(payload->>'channel', ''),
      nullif(payload->>'expires_at', '')::date,
      coalesce(nullif(payload->>'status', ''), 'draft')
    )
    returning id into v_id;
    perform admin_log('Created promo code', 'billing', 'promo', v_id::text, v_code, payload);
  else
    update promo_codes set
      offer      = coalesce(nullif(payload->>'offer', ''), offer),
      channel    = coalesce(nullif(payload->>'channel', ''), channel),
      expires_at = coalesce(nullif(payload->>'expires_at', '')::date, expires_at),
      status     = coalesce(nullif(payload->>'status', ''), status)
    where id = v_id;
    perform admin_log('Updated promo code', 'billing', 'promo', v_id::text, v_code, payload);
  end if;

  return v_id;
end;
$$;
revoke execute on function admin_upsert_promo(jsonb) from anon, public;
grant execute on function admin_upsert_promo(jsonb) to authenticated;
