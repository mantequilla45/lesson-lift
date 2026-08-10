-- Postgres grants EXECUTE to PUBLIC by default, which means the `anon` role can
-- reach every admin_* RPC over /rest/v1/rpc/. The is_admin() guard inside each
-- function already rejects them (anon has no auth.uid()), so this was never
-- exploitable — but there is no reason for a signed-out request to get as far
-- as the guard. Revoke anon explicitly; `authenticated` keeps its grant because
-- that is how a signed-in admin calls these.
--
-- Written as a loop over pg_proc rather than a list of signatures so it stays
-- correct as admin_* functions are added, and so it doesn't need updating every
-- time one changes its argument list.
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and (p.proname like 'admin\_%' or p.proname in ('monthly_allowance', 'is_admin'))
  loop
    execute format('revoke execute on function %s from anon, public', fn.sig);
  end loop;
end $$;

-- Re-grant to authenticated, since revoking from PUBLIC above also removes the
-- implicit path for roles that had no explicit grant of their own.
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and (p.proname like 'admin\_%' or p.proname in ('monthly_allowance', 'is_admin'))
      -- admin_log is called only from inside other definer functions and must
      -- stay unreachable from the API.
      and p.proname <> 'admin_log'
  loop
    execute format('grant execute on function %s to authenticated', fn.sig);
  end loop;
end $$;
