-- RPC updates for the money section of the admin console.
--
-- Companion to 20260812000100_money_admin_alignment.sql. Adds the reads the
-- reworked pages need and fixes the sales attribution that made real top-up
-- purchases invisible.

-- ── Top-up packs: attribute credit purchases ─────────────────────────────────
-- The old version joined `topup_purchases.pack_id = topup_packs.id`, but credit
-- top-ups have always been written with pack_id = null (there was no pack row to
-- point at). Every real sale therefore counted as zero against every pack.
--
-- The webhook now resolves and writes a real pack_id, but historical rows still
-- have null, so match on kind as well to pick those up. The two branches are
-- mutually exclusive per purchase (pack_id is either null or set), so no single
-- purchase is counted twice against one pack.
--
-- CAVEAT: the kind fallback is for orphaned historical rows only. If two active
-- packs ever shared a kind AND there were null-pack_id purchases of that kind,
-- both packs would claim the same rows. That cannot happen today (only
-- credit_gbp has a purchase path, and there is one credit pack), and the webhook
-- now stamps pack_id, so the null set stops growing. Drop the fallback once the
-- historical rows are backfilled.
--
-- Dropped first: the return type gains stripe_price_id, and Postgres refuses to
-- change an existing function's OUT columns in place.
drop function if exists admin_topup_packs();
create or replace function admin_topup_packs()
returns table (
  id uuid, kind text, name text, price_gbp numeric, unit integer,
  available_to text[], active boolean, stripe_price_id text,
  sold bigint, revenue_gbp numeric
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    select t.id, t.kind, t.name, t.price_gbp, t.unit, t.available_to, t.active,
           t.stripe_price_id,
           count(pu.id),
           coalesce(sum(pu.price_gbp), 0)
    from topup_packs t
    left join topup_purchases pu
      on pu.pack_id = t.id
      or (pu.pack_id is null and pu.kind = t.kind)
    group by t.id
    order by t.sort;
end;
$$;
revoke execute on function admin_topup_packs() from anon, public;
grant execute on function admin_topup_packs() to authenticated;

-- ── Recent top-ups ───────────────────────────────────────────────────────────
-- Purchases as they actually happened, independent of whether they resolve to a
-- pack. This is the list that answers "did my payment land?" — the packs table
-- cannot, because it aggregates.
--
-- Refund state lives in `invoices` (syncRefund marks the mirror row by charge
-- id), so join it in rather than reporting every purchase as good.
create or replace function admin_recent_topups(p_limit integer default 50)
returns table (
  id uuid, user_id uuid, email text, pack_name text,
  kind text, units integer, price_gbp numeric,
  status text, stripe_payment_intent_id text, created_at timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    select
      pu.id,
      pu.user_id,
      u.email::text,
      coalesce(t.name, 'AI credit top-up'),
      pu.kind,
      pu.units,
      pu.price_gbp,
      -- The mirror row is created moments after the purchase, so a very recent
      -- purchase can legitimately have none yet. Report that as 'paid' rather
      -- than inventing a failure: the money did arrive, the mirror is async.
      coalesce(inv.status, 'paid'),
      pu.stripe_payment_intent_id,
      pu.created_at
    from topup_purchases pu
    left join auth.users u on u.id = pu.user_id
    left join topup_packs t on t.id = pu.pack_id
    left join lateral (
      select i.status
      from invoices i
      where i.user_id = pu.user_id
        and i.type = 'topup'
        and i.amount_gbp = pu.price_gbp
        -- Same purchase, not merely a similar one: the mirror is written in the
        -- same handler, so anything beyond a couple of minutes is a different
        -- top-up by the same person for the same amount.
        and i.created_at between pu.created_at - interval '2 minutes'
                             and pu.created_at + interval '2 minutes'
      order by i.created_at
      limit 1
    ) inv on true
    order by pu.created_at desc
    limit greatest(p_limit, 1);
end;
$$;
revoke execute on function admin_recent_topups(integer) from anon, public;
grant execute on function admin_recent_topups(integer) to authenticated;

-- ── Top-up pack upsert ───────────────────────────────────────────────────────
-- Unchanged in shape, but now carries stripe_price_id so a pack can be tied to
-- the Price that actually sells it. The Stripe side of a price change is done by
-- the API route before this is called: Price objects are immutable, so the route
-- creates a new one, archives the old, and passes the new id down here.
create or replace function admin_upsert_topup_pack(payload jsonb)
returns uuid
language plpgsql volatile security definer set search_path = public
as $$
declare v_id uuid;
begin
  if not is_admin() then raise exception 'not authorized'; end if;

  v_id := nullif(payload->>'id', '')::uuid;

  if v_id is null then
    insert into topup_packs (kind, name, price_gbp, unit, available_to, active, sort, stripe_price_id)
    values (
      payload->>'kind', payload->>'name',
      (payload->>'price_gbp')::numeric, (payload->>'unit')::integer,
      coalesce(
        (select array_agg(value::text) from jsonb_array_elements_text(payload->'available_to')),
        array['free','pro']::text[]
      ),
      coalesce((payload->>'active')::boolean, true),
      coalesce((payload->>'sort')::integer, 99),
      nullif(payload->>'stripe_price_id', '')
    )
    returning id into v_id;
    perform admin_log('Created top-up pack', 'billing', 'topup_pack', v_id::text, payload->>'name', payload);
  else
    update topup_packs set
      name            = coalesce(nullif(payload->>'name', ''), name),
      price_gbp       = coalesce((payload->>'price_gbp')::numeric, price_gbp),
      unit            = coalesce((payload->>'unit')::integer, unit),
      active          = coalesce((payload->>'active')::boolean, active),
      stripe_price_id = coalesce(nullif(payload->>'stripe_price_id', ''), stripe_price_id)
    where id = v_id;
    perform admin_log('Updated top-up pack', 'billing', 'topup_pack', v_id::text, payload->>'name', payload);
  end if;

  return v_id;
end;
$$;
revoke execute on function admin_upsert_topup_pack(jsonb) from anon, public;
grant execute on function admin_upsert_topup_pack(jsonb) to authenticated;

-- ── Plans ────────────────────────────────────────────────────────────────────
-- Now returns the Stripe price pointer so the console can show what a plan is
-- actually billed on, and `retired` plans are excluded: Max is withdrawn from
-- sale and has no Stripe price, so an editable card for it invites setting a
-- price that can never be charged. The plan_config row stays put — legacy
-- accounts still resolve their limits through it.
--
-- Dropped first: the return type gains stripe_price_monthly.
drop function if exists admin_plans();
create or replace function admin_plans()
returns table (
  plan_id text, name text, audience text,
  price_monthly numeric, price_yearly numeric,
  monthly_resources integer, ai_image_slideshows integer,
  description text, status text, stripe_price_monthly text, users bigint
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    select c.plan_id, c.name, c.audience, c.price_monthly, c.price_yearly,
           c.monthly_resources, c.ai_image_slideshows, c.description, c.status,
           c.stripe_price_monthly,
           count(p.id)
    from plan_config c
    left join profiles p on coalesce(p.plan, 'free') = c.plan_id
    where c.status <> 'retired'
    group by c.plan_id, c.name, c.audience, c.price_monthly, c.price_yearly,
             c.monthly_resources, c.ai_image_slideshows, c.description, c.status,
             c.stripe_price_monthly, c.sort
    order by c.sort;
end;
$$;
revoke execute on function admin_plans() from anon, public;
grant execute on function admin_plans() to authenticated;

-- admin_update_plan keeps writing presentational fields only. The price fields
-- still land here, but the API route is now what makes a price real in Stripe
-- and it calls this afterwards so the two stay in step. Refresh the comment so
-- the next reader isn't told Stripe is never involved.
comment on function admin_update_plan(text, jsonb) is
  'Updates the presentational plan_config row. Does not create Stripe Prices — POST /api/admin/plans/price does that first (Price objects are immutable, so a change means a new Price), then calls this so the displayed figure matches.';

-- ── Pricing rules ────────────────────────────────────────────────────────────
-- Surfaces not_implemented so the console can render dead switches as disabled
-- instead of pretending they do something.
--
-- Dropped first: the return type gains not_implemented.
drop function if exists admin_pricing_rules();
create or replace function admin_pricing_rules()
returns table (
  key text, label text, description text,
  enabled boolean, not_implemented boolean, sort integer
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    select r.key, r.label, r.description, r.enabled, r.not_implemented, r.sort
    from pricing_rules r order by r.sort;
end;
$$;
revoke execute on function admin_pricing_rules() from anon, public;
grant execute on function admin_pricing_rules() to authenticated;

-- Refuse to toggle a rule nothing reads. Without this the API is still open even
-- though the UI disables the control, and a flipped flag would imply a behaviour
-- change that never happens.
create or replace function admin_set_pricing_rule(p_key text, p_enabled boolean)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare v_label text; v_dead boolean;
begin
  if not is_admin() then raise exception 'not authorized'; end if;

  select label, not_implemented into v_label, v_dead
    from pricing_rules where key = p_key;

  if v_label is null then raise exception 'no such rule'; end if;
  if v_dead then
    raise exception 'rule % is not wired up to any behaviour yet', p_key;
  end if;

  update pricing_rules
     set enabled = p_enabled, updated_by = auth.uid(), updated_at = now()
   where key = p_key;

  perform admin_log(
    case when p_enabled then 'Enabled pricing rule' else 'Disabled pricing rule' end,
    'billing', 'pricing_rule', p_key, v_label, jsonb_build_object('enabled', p_enabled));
end;
$$;
revoke execute on function admin_set_pricing_rule(text, boolean) from anon, public;
grant execute on function admin_set_pricing_rule(text, boolean) to authenticated;
