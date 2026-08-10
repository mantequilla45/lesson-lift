-- ── Content, team and settings RPCs ──────────────────────────────────────────

-- ── Copy ─────────────────────────────────────────────────────────────────────
create or replace function admin_copy_blocks()
returns table (
  key text, where_shown text, value text, draft text,
  version integer, live boolean, has_draft boolean, updated_at timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    select c.key, c.where_shown, c.value, c.draft, c.version, c.live,
           (c.draft is not null and c.draft is distinct from c.value),
           c.updated_at
    from copy_blocks c
    order by c.where_shown, c.key;
end;
$$;
revoke execute on function admin_copy_blocks() from anon, public;
grant execute on function admin_copy_blocks() to authenticated;

-- Save a draft. Never touches the live value — that only changes on publish.
create or replace function admin_save_copy_draft(p_key text, p_draft text)
returns void
language plpgsql volatile security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  if not admin_can('edit_copy') then
    raise exception 'your role cannot edit copy';
  end if;

  update copy_blocks
     set draft = p_draft, updated_by = auth.uid(), updated_at = now()
   where key = p_key;

  if not found then raise exception 'no such copy block'; end if;

  perform admin_log('Saved copy draft', 'content', 'copy_block', p_key, p_key,
    jsonb_build_object('length', length(p_draft)));
end;
$$;
revoke execute on function admin_save_copy_draft(text, text) from anon, public;
grant execute on function admin_save_copy_draft(text, text) to authenticated;

-- Promote the draft to live, snapshotting the previous value so it can be
-- rolled back.
create or replace function admin_publish_copy(p_key text)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare v_draft text; v_value text; v_version integer;
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  if not admin_can('edit_copy') then
    raise exception 'your role cannot publish copy';
  end if;

  select draft, value, version into v_draft, v_value, v_version
  from copy_blocks where key = p_key;

  if v_draft is null then raise exception 'nothing to publish'; end if;

  -- Snapshot what was live, so "restore" has something to restore to.
  if v_value is not null then
    insert into copy_block_versions (key, version, value, published_by)
    values (p_key, v_version, v_value, auth.uid())
    on conflict do nothing;
  end if;

  update copy_blocks
     set value = v_draft, draft = null, live = true,
         version = v_version + 1, updated_by = auth.uid(), updated_at = now()
   where key = p_key;

  perform admin_log('Published copy', 'content', 'copy_block', p_key, p_key,
    jsonb_build_object('version', v_version + 1));
end;
$$;
revoke execute on function admin_publish_copy(text) from anon, public;
grant execute on function admin_publish_copy(text) to authenticated;

create or replace function admin_copy_history(p_key text)
returns table (version integer, value text, published_by_email text, published_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    select v.version, v.value, u.email::text, v.published_at
    from copy_block_versions v
    left join auth.users u on u.id = v.published_by
    where v.key = p_key
    order by v.version desc;
end;
$$;
revoke execute on function admin_copy_history(text) from anon, public;
grant execute on function admin_copy_history(text) to authenticated;

-- ── Announcements ────────────────────────────────────────────────────────────
create or replace function admin_announcements()
returns table (
  id uuid, message text, type text, audience text, school_name text,
  dismissible boolean, starts_at timestamptz, ends_at timestamptz, live boolean,
  seen_count integer, dismissed_count integer, click_count integer,
  is_current boolean, created_at timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    select a.id, a.message, a.type, a.audience, sc.name,
           a.dismissible, a.starts_at, a.ends_at, a.live,
           a.seen_count, a.dismissed_count, a.click_count,
           (a.live and a.starts_at <= now() and (a.ends_at is null or a.ends_at > now())),
           a.created_at
    from announcements a
    left join schools sc on sc.id = a.school_id
    order by a.live desc, a.starts_at desc;
end;
$$;
revoke execute on function admin_announcements() from anon, public;
grant execute on function admin_announcements() to authenticated;

create or replace function admin_upsert_announcement(payload jsonb)
returns uuid
language plpgsql volatile security definer set search_path = public
as $$
declare v_id uuid;
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  v_id := nullif(payload->>'id', '')::uuid;

  if v_id is null then
    insert into announcements (message, type, audience, school_id, dismissible,
                               starts_at, ends_at, live, created_by)
    values (
      payload->>'message',
      coalesce(nullif(payload->>'type', ''), 'info'),
      coalesce(nullif(payload->>'audience', ''), 'everyone'),
      nullif(payload->>'school_id', '')::uuid,
      coalesce((payload->>'dismissible')::boolean, true),
      coalesce(nullif(payload->>'starts_at', '')::timestamptz, now()),
      nullif(payload->>'ends_at', '')::timestamptz,
      coalesce((payload->>'live')::boolean, false),
      auth.uid()
    )
    returning id into v_id;
    perform admin_log('Created announcement', 'content', 'announcement', v_id::text,
      left(payload->>'message', 60), payload);
  else
    update announcements set
      message     = coalesce(nullif(payload->>'message', ''), message),
      type        = coalesce(nullif(payload->>'type', ''), type),
      audience    = coalesce(nullif(payload->>'audience', ''), audience),
      dismissible = coalesce((payload->>'dismissible')::boolean, dismissible),
      ends_at     = coalesce(nullif(payload->>'ends_at', '')::timestamptz, ends_at),
      live        = coalesce((payload->>'live')::boolean, live)
    where id = v_id;
    perform admin_log('Updated announcement', 'content', 'announcement', v_id::text,
      left(coalesce(payload->>'message', ''), 60), payload);
  end if;

  return v_id;
end;
$$;
revoke execute on function admin_upsert_announcement(jsonb) from anon, public;
grant execute on function admin_upsert_announcement(jsonb) to authenticated;

-- ── Email templates ──────────────────────────────────────────────────────────
create or replace function admin_email_templates()
returns table (
  key text, name text, trigger_description text, subject text, body text,
  live boolean, sent_30d integer, open_rate numeric, click_rate numeric
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    select t.key, t.name, t.trigger_description, t.subject, t.body,
           t.live, t.sent_30d, t.open_rate, t.click_rate
    from email_templates t order by t.sort;
end;
$$;
revoke execute on function admin_email_templates() from anon, public;
grant execute on function admin_email_templates() to authenticated;

create or replace function admin_update_email_template(p_key text, payload jsonb)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare v_name text;
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  update email_templates set
    subject    = coalesce(payload->>'subject', subject),
    body       = coalesce(payload->>'body', body),
    live       = coalesce((payload->>'live')::boolean, live),
    updated_by = auth.uid(),
    updated_at = now()
  where key = p_key
  returning name into v_name;
  if v_name is null then raise exception 'no such template'; end if;
  perform admin_log('Updated email template', 'content', 'email_template', p_key, v_name, payload);
end;
$$;
revoke execute on function admin_update_email_template(text, jsonb) from anon, public;
grant execute on function admin_update_email_template(text, jsonb) to authenticated;

-- ── Team & roles ─────────────────────────────────────────────────────────────
create or replace function admin_team_members()
returns table (
  user_id uuid, email text, name text, role text,
  two_factor_enabled boolean, last_active_at timestamptz, is_you boolean
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    select
      u.id, u.email::text,
      nullif(trim(coalesce(p.first_name,'') || ' ' || coalesce(p.surname,'')), ''),
      -- Same default as admin_role(): an admin with no team row is super_admin.
      coalesce(t.role, 'super_admin'),
      coalesce(t.two_factor_enabled, false),
      greatest(t.last_active_at, (select max(a.created_at) from admin_audit_log a
                                   where a.actor_id = u.id)),
      u.id = auth.uid()
    from profiles p
    join auth.users u on u.id = p.id
    left join admin_team t on t.user_id = p.id
    where p.is_admin
    order by u.email;
end;
$$;
revoke execute on function admin_team_members() from anon, public;
grant execute on function admin_team_members() to authenticated;

create or replace function admin_set_role(uid uuid, p_role text)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare v_email text; v_supers integer;
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  if not admin_can('manage_admins') then
    raise exception 'your role cannot manage admins';
  end if;
  if p_role not in ('super_admin','support','finance','content','developer') then
    raise exception 'invalid role';
  end if;

  select u.email::text into v_email from auth.users u where u.id = uid;
  if v_email is null then raise exception 'no such user'; end if;

  -- Never let the last super admin demote themselves: that would leave nobody
  -- able to manage roles, with no way back through the UI.
  if p_role <> 'super_admin' then
    select count(*) into v_supers
    from profiles p
    left join admin_team t on t.user_id = p.id
    where p.is_admin and coalesce(t.role, 'super_admin') = 'super_admin'
      and p.id <> uid;
    if v_supers = 0 then
      raise exception 'cannot remove the last super admin';
    end if;
  end if;

  insert into admin_team (user_id, role, invited_by)
  values (uid, p_role, auth.uid())
  on conflict (user_id) do update set role = excluded.role;

  perform admin_log('Changed admin role', 'access', 'admin', uid::text, v_email,
    jsonb_build_object('role', p_role));
end;
$$;
revoke execute on function admin_set_role(uuid, text) from anon, public;
grant execute on function admin_set_role(uuid, text) to authenticated;

create or replace function admin_role_matrix()
returns table (permission text, role text, allowed boolean)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    select rp.permission, rp.role, rp.allowed from role_permissions rp
    order by rp.permission, rp.role;
end;
$$;
revoke execute on function admin_role_matrix() from anon, public;
grant execute on function admin_role_matrix() to authenticated;

-- What the current caller may do — lets the UI hide actions rather than
-- offering them and failing.
create or replace function admin_my_permissions()
returns table (role text, permission text, allowed boolean)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    select admin_role(), rp.permission, rp.allowed
    from role_permissions rp
    where rp.role = admin_role()
    order by rp.permission;
end;
$$;
revoke execute on function admin_my_permissions() from anon, public;
grant execute on function admin_my_permissions() to authenticated;

-- ── Settings ─────────────────────────────────────────────────────────────────
create or replace function admin_settings()
returns table (key text, label text, description text, section text, value jsonb, sort integer)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  return query
    select s.key, s.label, s.description, s.section, s.value, s.sort
    from app_settings s order by s.section, s.sort;
end;
$$;
revoke execute on function admin_settings() from anon, public;
grant execute on function admin_settings() to authenticated;

create or replace function admin_set_setting(p_key text, p_value jsonb)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare v_label text;
begin
  if not is_admin() then raise exception 'not authorized'; end if;
  update app_settings
     set value = p_value, updated_by = auth.uid(), updated_at = now()
   where key = p_key
  returning label into v_label;
  if v_label is null then raise exception 'no such setting'; end if;
  perform admin_log('Changed setting', 'access', 'setting', p_key, v_label,
    jsonb_build_object('value', p_value));
end;
$$;
revoke execute on function admin_set_setting(text, jsonb) from anon, public;
grant execute on function admin_set_setting(text, jsonb) to authenticated;
