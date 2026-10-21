create extension if not exists pgcrypto;

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  owner_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'closed')),
  max_members smallint not null default 2 check (max_members = 2),
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);

create table public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 32),
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table public.messages (
  id uuid primary key,
  room_id uuid not null references public.rooms(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index messages_room_created_idx
  on public.messages (room_id, created_at desc);

create table public.playback_state (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  media_id text,
  media_title text,
  playing boolean not null default false,
  position_ms bigint not null default 0 check (position_ms >= 0),
  duration_ms bigint check (duration_ms is null or duration_ms >= 0),
  version bigint not null default 0,
  effective_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.messages enable row level security;
alter table public.playback_state enable row level security;

grant select on public.rooms to authenticated;
grant select on public.room_members to authenticated;
grant select, insert on public.messages to authenticated;
grant select on public.playback_state to authenticated;

create or replace function public.is_room_member(target_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.room_members
    where room_id = target_room_id
      and user_id = auth.uid()
  );
$$;

revoke all on function public.is_room_member(uuid) from public;
grant execute on function public.is_room_member(uuid) to authenticated;

create policy "Members can read their rooms"
on public.rooms for select
to authenticated
using (public.is_room_member(id));

create policy "Members can read room membership"
on public.room_members for select
to authenticated
using (public.is_room_member(room_id));

create policy "Members can read room messages"
on public.messages for select
to authenticated
using (public.is_room_member(room_id));

create policy "Members can send room messages"
on public.messages for insert
to authenticated
with check (
  sender_id = auth.uid()
  and public.is_room_member(room_id)
);

create policy "Members can read playback state"
on public.playback_state for select
to authenticated
using (public.is_room_member(room_id));

create or replace function public.generate_room_code()
returns text
language plpgsql
volatile
set search_path = public, pg_temp
as $$
declare
  raw_code text;
begin
  raw_code := upper(encode(gen_random_bytes(8), 'hex'));
  return substr(raw_code, 1, 4) || '-' ||
         substr(raw_code, 5, 4) || '-' ||
         substr(raw_code, 9, 4) || '-' ||
         substr(raw_code, 13, 4);
end;
$$;

revoke all on function public.generate_room_code() from public;

create or replace function public.create_room(p_display_name text default 'Bubu')
returns table (room_id uuid, room_code text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  new_room_id uuid;
  new_room_code text;
  normalized_name text := trim(p_display_name);
begin
  if current_user_id is null then
    raise exception 'Authentication is required';
  end if;

  if char_length(normalized_name) not between 1 and 32 then
    raise exception 'Display name must contain between 1 and 32 characters';
  end if;

  loop
    new_room_code := public.generate_room_code();
    begin
      insert into public.rooms (code, owner_id)
      values (new_room_code, current_user_id)
      returning id into new_room_id;
      exit;
    exception when unique_violation then
      null;
    end;
  end loop;

  insert into public.room_members (room_id, user_id, display_name, role)
  values (new_room_id, current_user_id, normalized_name, 'owner');

  insert into public.playback_state (room_id, updated_by)
  values (new_room_id, current_user_id);

  return query select new_room_id, new_room_code;
end;
$$;

revoke all on function public.create_room(text) from public;
grant execute on function public.create_room(text) to authenticated;

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
    select 1 from public.room_members
    where room_id = target_room.id and user_id = current_user_id
  ) then
    update public.rooms
      set last_active_at = now(), expires_at = now() + interval '7 days'
      where id = target_room.id;
    return query select target_room.id, target_room.code;
    return;
  end if;

  select count(*) into member_count
  from public.room_members
  where room_id = target_room.id;

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

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then
  null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.playback_state;
exception when duplicate_object then
  null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.room_members;
exception when duplicate_object then
  null;
end;
$$;
