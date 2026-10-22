-- Security boundary for active rooms, private Realtime channels, catalogue
-- quotas, and recoverable room lifecycle operations.

create or replace function public.is_active_room_member(target_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.room_members as member
    join public.rooms as room on room.id = member.room_id
    where member.room_id = target_room_id
      and member.user_id = auth.uid()
      and room.status = 'open'
      and room.expires_at > now()
  );
$$;

revoke all on function public.is_active_room_member(uuid) from public;
grant execute on function public.is_active_room_member(uuid) to authenticated;

-- Preserve the existing function name used by earlier RPCs while strengthening
-- its semantics to reject closed and expired rooms.
create or replace function public.is_room_member(target_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_active_room_member(target_room_id);
$$;

revoke all on function public.is_room_member(uuid) from public;
grant execute on function public.is_room_member(uuid) to authenticated;

drop policy if exists "Members can read their rooms" on public.rooms;
create policy "Active members can read their rooms"
on public.rooms for select
to authenticated
using (public.is_active_room_member(id));

drop policy if exists "Members can read room membership" on public.room_members;
create policy "Active members can read room membership"
on public.room_members for select
to authenticated
using (public.is_active_room_member(room_id));

drop policy if exists "Members can update their readiness" on public.room_members;
create policy "Active members can update their readiness"
on public.room_members for update
to authenticated
using (
  user_id = auth.uid()
  and public.is_active_room_member(room_id)
)
with check (
  user_id = auth.uid()
  and public.is_active_room_member(room_id)
);

drop policy if exists "Members can read room messages" on public.messages;
create policy "Active members can read room messages"
on public.messages for select
to authenticated
using (public.is_active_room_member(room_id));

drop policy if exists "Members can send room messages" on public.messages;
create policy "Active members can send room messages"
on public.messages for insert
to authenticated
with check (
  sender_id = auth.uid()
  and public.is_active_room_member(room_id)
);

grant delete on public.messages to authenticated;
drop policy if exists "Members can delete their messages" on public.messages;
create policy "Active members can delete their own messages"
on public.messages for delete
to authenticated
using (
  sender_id = auth.uid()
  and public.is_active_room_member(room_id)
);

drop policy if exists "Members can read playback state" on public.playback_state;
create policy "Active members can read playback state"
on public.playback_state for select
to authenticated
using (public.is_active_room_member(room_id));

-- Private Broadcast and Presence authorization. The client topic format is
-- `room:<uuid>`, and both sending and receiving require active membership.
drop policy if exists "Active members can receive room realtime" on realtime.messages;
create policy "Active members can receive room realtime"
on realtime.messages for select
to authenticated
using (
  extension in ('broadcast', 'presence')
  and exists (
    select 1
    from public.room_members as member
    join public.rooms as room on room.id = member.room_id
    where member.user_id = auth.uid()
      and room.status = 'open'
      and room.expires_at > now()
      and realtime.topic() = 'room:' || member.room_id::text
  )
);

drop policy if exists "Active members can send room realtime" on realtime.messages;
create policy "Active members can send room realtime"
on realtime.messages for insert
to authenticated
with check (
  extension in ('broadcast', 'presence')
  and exists (
    select 1
    from public.room_members as member
    join public.rooms as room on room.id = member.room_id
    where member.user_id = auth.uid()
      and room.status = 'open'
      and room.expires_at > now()
      and realtime.topic() = 'room:' || member.room_id::text
  )
);

create table if not exists public.catalog_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('browse', 'search')),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, action)
);

alter table public.catalog_rate_limits enable row level security;
revoke all on public.catalog_rate_limits from anon, authenticated;

create or replace function public.consume_catalog_rate_limit(p_action text)
returns table (allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  action_limit integer;
  rate_row public.catalog_rate_limits%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication is required';
  end if;

  if p_action not in ('browse', 'search') then
    raise exception 'Unsupported rate-limit action';
  end if;

  action_limit := case when p_action = 'search' then 10 else 120 end;

  insert into public.catalog_rate_limits (user_id, action, request_count)
  values (current_user_id, p_action, 1)
  on conflict (user_id, action) do update
  set
    window_started_at = case
      when catalog_rate_limits.window_started_at <= now() - interval '1 hour'
        then now()
      else catalog_rate_limits.window_started_at
    end,
    request_count = case
      when catalog_rate_limits.window_started_at <= now() - interval '1 hour'
        then 1
      else catalog_rate_limits.request_count + 1
    end,
    updated_at = now()
  returning * into rate_row;

  if rate_row.request_count > action_limit then
    return query select
      false,
      0,
      greatest(
        1,
        ceil(extract(epoch from (rate_row.window_started_at + interval '1 hour' - now())))::integer
      );
    return;
  end if;

  return query select true, action_limit - rate_row.request_count, 0;
end;
$$;

revoke all on function public.consume_catalog_rate_limit(text) from public;
grant execute on function public.consume_catalog_rate_limit(text) to authenticated;

create or replace function public.close_room(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.rooms
  set status = 'closed', last_active_at = now()
  where id = p_room_id
    and owner_id = auth.uid()
    and status = 'open';
  return found;
end;
$$;

create or replace function public.leave_room(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  is_owner boolean;
begin
  select room.owner_id = auth.uid() into is_owner
  from public.rooms as room
  where room.id = p_room_id;

  if is_owner then
    update public.rooms
    set status = 'closed', last_active_at = now()
    where id = p_room_id;
    return found;
  end if;

  delete from public.room_members
  where room_id = p_room_id and user_id = auth.uid();
  return found;
end;
$$;

create or replace function public.delete_room(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.rooms
  where id = p_room_id and owner_id = auth.uid();
  return found;
end;
$$;

create or replace function public.rotate_room_code(p_room_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  next_code text;
begin
  if not exists (
    select 1 from public.rooms
    where id = p_room_id
      and owner_id = auth.uid()
      and status = 'open'
      and expires_at > now()
  ) then
    raise exception 'Only the active room owner can rotate the invitation';
  end if;

  loop
    next_code := public.generate_room_code();
    begin
      update public.rooms
      set code = next_code, last_active_at = now()
      where id = p_room_id;
      exit;
    exception when unique_violation then
      null;
    end;
  end loop;

  return next_code;
end;
$$;

create or replace function public.cleanup_expired_rooms()
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  deleted_count bigint;
begin
  delete from public.rooms
  where expires_at <= now()
     or (status = 'closed' and last_active_at <= now() - interval '24 hours');
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.close_room(uuid) from public;
revoke all on function public.leave_room(uuid) from public;
revoke all on function public.delete_room(uuid) from public;
revoke all on function public.rotate_room_code(uuid) from public;
revoke all on function public.cleanup_expired_rooms() from public;
grant execute on function public.close_room(uuid) to authenticated;
grant execute on function public.leave_room(uuid) to authenticated;
grant execute on function public.delete_room(uuid) to authenticated;
grant execute on function public.rotate_room_code(uuid) to authenticated;
grant execute on function public.cleanup_expired_rooms() to service_role;

notify pgrst, 'reload schema';
