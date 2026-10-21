-- Readiness must be durable room state so both participants see the same lobby.
alter table public.room_members
  add column if not exists is_ready boolean not null default false;

grant update (is_ready) on public.room_members to authenticated;

drop policy if exists "Members can update their readiness" on public.room_members;
create policy "Members can update their readiness"
on public.room_members for update
to authenticated
using (
  user_id = auth.uid()
  and public.is_room_member(room_id)
)
with check (
  user_id = auth.uid()
  and public.is_room_member(room_id)
);

notify pgrst, 'reload schema';
