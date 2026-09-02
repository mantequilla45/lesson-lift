-- Multiple top-up packs.
--
-- Creating a second credit pack already produced a real Stripe price and a real
-- topup_packs row, but nothing could buy it: both the checkout price lookup and
-- the webhook's attribution hardcoded "the lowest-sort active credit pack".
-- Those two are fixed in application code (app/lib/stripe.ts,
-- app/api/stripe/webhook/route.ts), which now carries the chosen pack id
-- through Stripe metadata.
--
-- Two things had to change in the database for the admin console to be able to
-- MANAGE more than one pack. Neither is environment-specific, so this same file
-- applies to staging and production.

-- ── 1. admin_upsert_topup_pack: let an edit change `sort` and `available_to` ──
--
-- The UPDATE branch set name, price_gbp, unit, active and stripe_price_id, and
-- silently dropped everything else in the payload. With one pack that was
-- invisible. With several it is not:
--
--   * `sort` decides display order in the modal AND which pack is the default
--     for a caller that names none, so an uneditable sort means a new pack can
--     never be reordered or made the default.
--   * `available_to` decides which plans are offered the pack. The route has
--     been passing it since the fix that stopped every save resetting it to
--     ['free','pro'] — but the function then discarded it, so the bug appeared
--     fixed while remaining unfixable from the console.
--
-- Both are coalesced, so a payload that omits them still leaves them alone.
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
        array['free','pro','max']::text[]
      ),
      coalesce((payload->>'active')::boolean, true),
      -- Was a flat 99, so every pack created from the console collided on the
      -- same sort and `order by sort limit 1` picked between them arbitrarily.
      -- Append to the end of the list instead.
      coalesce(
        (payload->>'sort')::integer,
        (select coalesce(max(sort), 0) + 1 from topup_packs)
      ),
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
      sort            = coalesce((payload->>'sort')::integer, sort),
      available_to    = coalesce(
                          (select array_agg(value::text)
                             from jsonb_array_elements_text(payload->'available_to')),
                          available_to
                        ),
      stripe_price_id = coalesce(nullif(payload->>'stripe_price_id', ''), stripe_price_id)
    where id = v_id;
    perform admin_log('Updated top-up pack', 'billing', 'topup_pack', v_id::text, payload->>'name', payload);
  end if;

  return v_id;
end;
$$;
revoke execute on function admin_upsert_topup_pack(jsonb) from anon, public;
grant execute on function admin_upsert_topup_pack(jsonb) to authenticated;

-- ── 2. admin_topup_packs: stop double-counting revenue, and expose `sort` ─────
--
-- The join carried a fallback for purchases recorded before the webhook stamped
-- pack_id:
--
--   left join topup_purchases pu
--     on pu.pack_id = t.id or (pu.pack_id is null and pu.kind = t.kind)
--
-- Every null-pack_id purchase therefore joined to EVERY pack of that kind. With
-- one credit pack that was harmless and gave those legacy rows a home. With two
-- it reports the same sale, and the same revenue, against both — so each pack's
-- figures are wrong and the total is inflated.
--
-- The original comment said to drop the fallback once the historical rows were
-- backfilled. They now number one row in production and two in staging, and
-- attributing those to no pack is a far smaller error than counting them twice.
--
-- `sort` is added to the return so the console can show and edit ordering,
-- which is what makes the fix above reachable.
drop function if exists admin_topup_packs();
create or replace function admin_topup_packs()
returns table (
  id uuid, kind text, name text, price_gbp numeric, unit integer,
  available_to text[], active boolean, stripe_price_id text, sort integer,
  sold bigint, revenue_gbp numeric
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    select t.id, t.kind, t.name, t.price_gbp, t.unit, t.available_to, t.active,
           t.stripe_price_id, t.sort,
           count(pu.id),
           coalesce(sum(pu.price_gbp), 0)
    from topup_packs t
    left join topup_purchases pu on pu.pack_id = t.id
    group by t.id
    order by t.sort;
end;
$$;
revoke execute on function admin_topup_packs() from anon, public;
grant execute on function admin_topup_packs() to authenticated;
