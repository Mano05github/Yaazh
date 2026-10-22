# Yaazh

Yaazh is a private two-person room for discovering music and videos, chatting,
and keeping playback synchronized across browsers and devices.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and add the Supabase public URL and anon key.
3. Enable anonymous sign-ins in Supabase Authentication.
4. Run the SQL files in `supabase/migrations` in filename order.
5. Run `npm run dev` and open `http://localhost:3000`.

## YouTube catalogue

Enable **YouTube Data API v3** in Google Cloud, create an API key restricted to
that API, and add it as the server-only `YOUTUBE_DATA_API_KEY` value in
`.env.local`. Do not prefix this key with `NEXT_PUBLIC_`.

- Music and Watch tabs appear only after both participants enter a room and
  choose **Begin together**.
- Selecting an item from the shared room library opens it for both participants.
- A connected player can use **Browse together** to replace the current item.

YouTube search consumes substantially more API quota than popular-video lists,
so Yaazh caches identical search requests for one hour.

## Verification

```bash
npm run lint
npm run typecheck
npm run build
```
