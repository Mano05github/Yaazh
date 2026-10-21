-- pgcrypto functions may live in the `extensions` schema on Supabase. Use
-- PostgreSQL's built-in UUID generator so room-code creation is independent
-- of extension schema placement.
create or replace function public.generate_room_code()
returns text
language plpgsql
volatile
set search_path = public, pg_temp
as $$
declare
  raw_code text;
begin
  raw_code := upper(replace(gen_random_uuid()::text, '-', ''));
  return substr(raw_code, 1, 4) || '-' ||
         substr(raw_code, 5, 4) || '-' ||
         substr(raw_code, 9, 4) || '-' ||
         substr(raw_code, 13, 4);
end;
$$;

revoke all on function public.generate_room_code() from public;

notify pgrst, 'reload schema';
