-- ── Closing a ticket clears the teacher's unread badge ───────────────────────
-- my_support_unread() counts threads holding an outbound message newer than
-- user_last_read_at, and never looked at status. That timestamp only moves when
-- the teacher opens that specific thread (my_mark_read, called from
-- app/help/Conversation.tsx).
--
-- So the common support flow left a teacher permanently badged:
--
--   1. teacher writes in
--   2. support replies and marks the ticket resolved in the same sitting
--   3. teacher never opens the thread again — the question is answered, and
--      the reply already arrived by email
--   4. the bell keeps a red 1 on it forever
--
-- Live example before this migration: TK-1006, status 'closed', two outbound
-- messages both counting as unread.
--
-- Closing now marks the thread read for the teacher. The reply is not hidden —
-- it stays in /help under the closed conversation — it just stops nagging about
-- a conversation that is over.
--
-- Note this only fires on the transition into 'closed'. Reopening a ticket and
-- replying again badges the teacher afresh, which is correct: that is a live
-- conversation once more.

create or replace function admin_set_thread(tid uuid, payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare v_ref text; v_status text;
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  v_status := nullif(payload->>'status', '');
  if v_status is not null and v_status not in ('open','pending','closed') then
    raise exception 'invalid status';
  end if;

  update support_threads set
    status      = coalesce(v_status, status),
    priority    = coalesce(nullif(payload->>'priority', ''), priority),
    assigned_to = case
                    when payload ? 'assign_to_me' and (payload->>'assign_to_me')::boolean then auth.uid()
                    when payload ? 'unassign' and (payload->>'unassign')::boolean then null
                    else assigned_to end,
    unread      = case when payload ? 'read' and (payload->>'read')::boolean then false else unread end,
    closed_at   = case when v_status = 'closed' then now()
                       when v_status is not null then null else closed_at end,
    -- Resolving the ticket resolves it for both sides. greatest() keeps this
    -- monotonic, matching my_mark_read: the timestamp only ever moves forward,
    -- so this can never un-read something.
    user_last_read_at = case
                          when v_status = 'closed'
                          then greatest(coalesce(user_last_read_at, '-infinity'::timestamptz), now())
                          else user_last_read_at end,
    updated_at  = now()
  where id = tid returning reference into v_ref;

  if v_ref is null then raise exception 'no such thread'; end if;
  perform admin_log('Updated ticket', 'other', 'support_thread', tid::text, v_ref, payload);
end;
$function$;

revoke execute on function admin_set_thread(uuid, jsonb) from anon, public;
grant execute on function admin_set_thread(uuid, jsonb) to authenticated;

-- Backfill: threads closed before this migration are carrying exactly the stale
-- badge described above. Clear them the same way.
--
-- closed_at is preferred over now() so the timestamp reflects when the ticket
-- was actually resolved rather than when this migration happened to run.
update support_threads
   set user_last_read_at = greatest(
         coalesce(user_last_read_at, '-infinity'::timestamptz),
         coalesce(closed_at, updated_at, now()))
 where status = 'closed';
