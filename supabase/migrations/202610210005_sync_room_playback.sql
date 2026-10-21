-- Durable playback state lets different browsers, profiles, and devices share
-- play, pause, seek, and media-selection commands.
alter table public.playback_state
  add column if not exists media_source text not null default 'demo',
  add column if not exists media_thumbnail text;

alter table public.playback_state
  alter column media_id set default 'demo-until-we-meet-again',
  alter column media_title set default 'Until We Meet Again',
  alter column duration_ms set default 247000;

update public.playback_state
set
  media_id = coalesce(media_id, 'demo-until-we-meet-again'),
  media_title = coalesce(media_title, 'Until We Meet Again'),
  duration_ms = coalesce(duration_ms, 247000)
where media_id is null or media_title is null or duration_ms is null;

do $$
begin
  alter table public.playback_state
    add constraint playback_state_media_source_check
    check (media_source in ('demo', 'youtube', 'local'));
exception when duplicate_object then
  null;
end;
$$;

create or replace function public.update_room_playback(
  p_room_id uuid,
  p_media_id text default null,
  p_media_title text default null,
  p_media_source text default null,
  p_media_thumbnail text default null,
  p_playing boolean default null,
  p_position_ms bigint default null,
  p_duration_ms bigint default null
)
returns table (
  room_id uuid,
  media_id text,
  media_title text,
  media_source text,
  media_thumbnail text,
  playing boolean,
  position_ms bigint,
  duration_ms bigint,
  version bigint,
  effective_at timestamptz,
  updated_at timestamptz,
  updated_by uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  if not public.is_room_member(p_room_id) then
    raise exception 'You are not a member of this room';
  end if;

  if p_media_source is not null
     and p_media_source not in ('demo', 'youtube', 'local') then
    raise exception 'Unsupported media source';
  end if;

  return query
  update public.playback_state as playback
  set
    media_id = coalesce(p_media_id, playback.media_id),
    media_title = coalesce(p_media_title, playback.media_title),
    media_source = coalesce(p_media_source, playback.media_source),
    media_thumbnail = coalesce(p_media_thumbnail, playback.media_thumbnail),
    playing = case
      when p_media_id is not null and p_media_id is distinct from playback.media_id
        then coalesce(p_playing, false)
      else coalesce(p_playing, playback.playing)
    end,
    position_ms = case
      when p_media_id is not null and p_media_id is distinct from playback.media_id
        then greatest(coalesce(p_position_ms, 0), 0)
      else greatest(coalesce(p_position_ms, playback.position_ms), 0)
    end,
    duration_ms = case
      when p_media_id is not null and p_media_id is distinct from playback.media_id
        then p_duration_ms
      else coalesce(p_duration_ms, playback.duration_ms)
    end,
    version = playback.version + 1,
    effective_at = now(),
    updated_at = now(),
    updated_by = auth.uid()
  where playback.room_id = p_room_id
  returning
    playback.room_id,
    playback.media_id,
    playback.media_title,
    playback.media_source,
    playback.media_thumbnail,
    playback.playing,
    playback.position_ms,
    playback.duration_ms,
    playback.version,
    playback.effective_at,
    playback.updated_at,
    playback.updated_by;
end;
$$;

revoke all on function public.update_room_playback(
  uuid, text, text, text, text, boolean, bigint, bigint
) from public;
grant execute on function public.update_room_playback(
  uuid, text, text, text, text, boolean, bigint, bigint
) to authenticated;

notify pgrst, 'reload schema';
