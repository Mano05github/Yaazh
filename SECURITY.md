# Yaazh security and privacy

Yaazh treats a room as a short-lived private space. The application enforces
authorization in PostgreSQL Row Level Security, not only in the interface.

## Controls implemented

- Room, membership, chat, playback, and catalogue access require an active,
  unexpired room membership.
- Realtime Broadcast and Presence use authenticated private channels scoped to
  the room UUID.
- YouTube catalogue requests require the caller's Supabase access token and an
  active room membership. Browse and search have separate hourly limits.
- Room owners can close, rotate, or delete rooms; participants can leave.
- Expired rooms can be removed with `public.cleanup_expired_rooms()`.
- Browser security headers are enabled. Content Security Policy starts in
  report-only mode so YouTube/Supabase violations can be observed before it is
  enforced.
- The YouTube API key remains server-only and must be restricted to YouTube
  Data API v3 in Google Cloud.

## Required Supabase deployment steps

1. Apply every migration in `supabase/migrations` in filename order.
2. Open **Realtime > Settings** and disable **Allow public access**. Do this
   immediately after applying migration `202610230006_security_hardening.sql`;
   private channels will not connect before the policies exist.
3. Schedule room cleanup at least hourly. With `pg_cron` enabled, run this once
   in the SQL editor:

   ```sql
   select cron.schedule(
     'yaazh-expired-room-cleanup',
     '15 * * * *',
     $$select public.cleanup_expired_rooms();$$
   );
   ```

4. Before making Yaazh public, configure Supabase CAPTCHA protection for
   anonymous sign-ins. CAPTCHA is not yet enabled in the client because it
   requires the production site key and allowed hostnames.
5. Keep the service-role key out of this repository and all `NEXT_PUBLIC_*`
   variables. Yaazh currently does not require it in the application runtime.
6. Review Supabase Auth rate limits and set a spend/quota alert for Google
   Cloud's YouTube API.

## Verification before launch

- Confirm an unrelated signed-in user cannot select a room, messages, members,
  or playback state using the Supabase API.
- Confirm a guessed room UUID cannot subscribe to Broadcast or Presence.
- Confirm closed and expired rooms immediately lose database, Realtime, and
  catalogue access.
- Inspect production browser CSP reports, add only necessary sources, then
  change `Content-Security-Policy-Report-Only` to `Content-Security-Policy`.
- Run `npm run lint`, `npm run typecheck`, and `npm run build`.

Do not upload user media to shared storage yet. Local file selection remains
device-local; supporting large shared files requires a separate direct-to-object
storage design with quotas, resumable multipart upload, malware handling,
retention, deletion, and cost controls.
