-- `join_room` returns a column named `room_id`, which also becomes a PL/pgSQL
-- output variable. Qualify membership columns so PostgreSQL does not confuse
-- them with that output variable.
create or replace function public.join_room(
  p_room_code text,
  p_display_name text default 'Dudu'
)
returns table (room_id uuid, room_code text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  target_room public.rooms%rowtype;
  member_count integer;
  normalized_code text := upper(trim(p_room_code));
  normalized_name text := trim(p_display_name);
begin
  if current_user_id is null then
    raise exception 'Authentication is required';
  end if;

  if char_length(normalized_name) not between 1 and 32 then
    raise exception 'Display name must contain between 1 and 32 characters';
  end if;

  select * into target_room
  from public.rooms
  where code = normalized_code
  for update;

  if target_room.id is null then
    raise exception 'Room not found';
  end if;

  if target_room.status <> 'open' or target_room.expires_at <= now() then
    raise exception 'This room is no longer available';
  end if;

  if exists (
    select 1
    from public.room_members as member
    where member.room_id = target_room.id
      and member.user_id = current_user_id
  ) then
    update public.rooms
      set last_active_at = now(), expires_at = now() + interval '7 days'
      where id = target_room.id;
    return query select target_room.id, target_room.code;
    return;
  end if;

  select count(*) into member_count
  from public.room_members as member
  where member.room_id = target_room.id;

  if member_count >= target_room.max_members then
    raise exception 'This room already has two participants';
  end if;

  insert into public.room_members (room_id, user_id, display_name, role)
  values (target_room.id, current_user_id, normalized_name, 'member');

  update public.rooms
    set last_active_at = now(), expires_at = now() + interval '7 days'
    where id = target_room.id;

  return query select target_room.id, target_room.code;
end;
$$;

revoke all on function public.join_room(text, text) from public;
grant execute on function public.join_room(text, text) to authenticated;

notify pgrst, 'reload schema';
