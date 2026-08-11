-- ── Let admins grant AI credit in pounds ─────────────────────────────────────
--
-- admin_grant_allowance() only accepted 'resource' and 'ai_image', both counted
-- in whole units by monthly_allowance(). Those meter the FREE plan's caps.
--
-- The thing that actually blocks a PRO teacher is a different mechanism: the
-- £1.50 monthly AI spend ceiling (AI_SPEND_CEILING_PENCE), measured in real
-- provider cost by monthly_ai_spend() and topped up by 'credit_gbp' grants.
-- Until now only the Stripe webhook could create those, so a Pro teacher who
-- hit the ceiling — exactly the person most likely to open a support ticket —
-- could not be helped from the admin console at all. Granting them resources
-- did nothing, because generation-guard.ts never reads that number for them.
--
-- This adds 'credit_gbp' as a third grantable kind. As documented in
-- 20260810000100_cost_ceiling.sql, `amount` is PENCE for this kind (£1.50 ->
-- 150) because the column is integer; the unit varies by kind.

create or replace function admin_grant_allowance(
  uid     uuid,
  p_kind  text,
  p_amount integer,
  p_reason text default 'Goodwill — support issue'
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id    uuid;
  v_label text;
begin
  if not is_admin() then raise exception 'not authorized'; end if;

  if p_kind not in ('resource', 'ai_image', 'credit_gbp') then
    raise exception 'kind must be resource, ai_image or credit_gbp';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;
  -- Guard rail: an AI-image grant is ~28p a unit, so a fat-fingered 1000 is
  -- £280 of cost. Cap each kind at something a human would plausibly intend.
  if p_kind = 'ai_image' and p_amount > 500 then
    raise exception 'AI-image grants are capped at 500';
  end if;
  if p_kind = 'resource' and p_amount > 10000 then
    raise exception 'resource grants are capped at 10000';
  end if;
  -- £50 in pence. Well above the £1.50 top-up a blocked teacher needs, well
  -- below the point where a slipped decimal is expensive.
  if p_kind = 'credit_gbp' and p_amount > 5000 then
    raise exception 'credit grants are capped at £50';
  end if;

  insert into allowance_grants (user_id, kind, amount, reason, granted_by, expires_at)
  values (
    uid, p_kind, p_amount, p_reason, auth.uid(),
    -- Expires at the end of the current month; grants never roll over. Same
    -- rule as purchased credit, so a granted top-up behaves like a bought one.
    (date_trunc('month', now()) + interval '1 month')
  )
  returning id into v_id;

  select coalesce(nullif(trim(coalesce(p.first_name,'') || ' ' || coalesce(p.surname,'')), ''), u.email::text)
    into v_label
  from auth.users u
  left join profiles p on p.id = u.id
  where u.id = uid;

  perform admin_log(
    case
      when p_kind = 'ai_image' then 'Granted ' || p_amount || ' AI-image slideshows'
      when p_kind = 'credit_gbp' then 'Granted £' || to_char(p_amount / 100.0, 'FM999990.00') || ' of AI credit'
      else 'Granted ' || p_amount || ' resources'
    end,
    'account',
    'user',
    uid::text,
    v_label,
    jsonb_build_object('kind', p_kind, 'amount', p_amount, 'reason', p_reason)
  );

  return v_id;
end;
$$;
revoke execute on function admin_grant_allowance(uuid, text, integer, text) from anon, public;
grant execute on function admin_grant_allowance(uuid, text, integer, text) to authenticated;
