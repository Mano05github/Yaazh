# Supabase setup for Yaazh

Yaazh uses Supabase only as a lightweight control plane for identities, rooms,
presence, chat, and playback state. Large media files are not uploaded.

## One-time dashboard setup

1. Open the Yaazh project in the Supabase dashboard.
2. Go to **Authentication → Providers → Anonymous Sign-Ins** and enable it.
3. Go to **SQL Editor**, create a new query, and run the full contents of:
   `supabase/migrations/202610210001_rooms_chat.sql`.
4. Confirm that `rooms`, `room_members`, `messages`, and `playback_state`
   appear in **Table Editor**.
5. Confirm Row Level Security is enabled for all four tables.

If the initial migration was already applied before the room-code generator
fix, also run `supabase/migrations/202610210002_fix_room_code_generator.sql`.
If it was applied before the join-room ambiguity fix, also run
`supabase/migrations/202610210003_fix_join_room_ambiguity.sql`.

## Local environment

Keep these values in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

The publishable/anonymous key is designed for browser use. Never place a
service-role or secret key in a `NEXT_PUBLIC_` variable.

Restart `npm.cmd run dev` after changing environment variables.

## Smoke test

1. Open Yaazh in one normal browser profile and create a room.
2. Copy the invitation link.
3. Open the link in a different browser profile or private session so it gets
   a distinct anonymous identity.
4. Join the room and confirm both clients show presence.
5. Open chat in both clients and exchange messages.
6. Refresh both clients and confirm message history is restored.
