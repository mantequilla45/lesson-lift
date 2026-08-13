-- Delete the four seeded top-up packs that were never sellable.
--
-- 100/300 extra resources and 10/25 AI-image slideshows were seeded in
-- 20260805000900_billing.sql from the console mockup. None of them ever had a
-- Stripe Price, and nothing in the app has ever created a Checkout session for
-- them — they could not be bought. 20260812000300 deactivated them; this removes
-- them, because an inactive row still shows on the admin Packs table and invites
-- someone to "just re-enable" a product that does not exist.
--
-- Safe to delete rather than retire: verified zero rows in topup_purchases
-- reference them, by pack_id or by kind. Guarded below so this is still true at
-- migration time in any environment.
--
-- The only thing Jooma sells is the £1.50 AI credit top-up, which stays.

do $$
declare v_sold integer;
begin
  select count(*) into v_sold
  from topup_purchases pu
  where pu.kind in ('resource', 'ai_image')
     or pu.pack_id in (select id from topup_packs where kind in ('resource', 'ai_image'));

  if v_sold > 0 then
    -- Someone has actually bought one, so deleting would orphan a paid purchase
    -- and lose the name it was sold under. Keep the row, just hidden.
    raise notice 'Keeping % legacy pack purchase(s): deactivating instead of deleting.', v_sold;
    update topup_packs set active = false where kind in ('resource', 'ai_image');
  else
    delete from topup_packs where kind in ('resource', 'ai_image');
  end if;
end $$;

-- Reflect the narrowed catalogue: credit is the only kind with a purchase path.
-- Left permissive rather than locked to credit_gbp alone so a future pack type
-- can be added without a constraint migration.
comment on table topup_packs is
  'What a teacher can buy on top of their plan. Only kind=credit_gbp is sellable today; a pack needs a stripe_price_id before checkout can charge for it.';
