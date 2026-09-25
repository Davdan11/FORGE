# FORGE live server

Who is riding the same road right now, for the indoor game. One small Node process: every rider's position in
memory (never stored), and twice a second each rider gets only the riders near them (1.2 km ahead and behind,
the 60 closest). Measured on a desktop: 100 riders on one map = under 1 % of a core, 0.8-1.4 KB/s per rider;
500 riders = 4 %.

## Run it

- Locally, with test accounts: `npm install`, then `LIVE_DEV=1 npm start`, and `node bots.mjs 100 30` for
  100 pretend riders.
- For real: set `SUPABASE_URL=https://xxxx.supabase.co` (the server checks each rider's sign-in with the
  project's public keys; no secret needed). Projects still on the old shared JWT secret set
  `SUPABASE_JWT_SECRET` instead (Supabase → Project Settings → JWT). Deploy the Dockerfile anywhere
  (Fly.io, Railway, Render: the smallest machine is enough), with HTTPS so the address is `wss://…`.
- Then build the app with `NEXT_PUBLIC_LIVE_URL=wss://your-server` in `.env.local`. Without it, the app keeps
  Supabase Realtime rooms (fine for a handful of riders).

`GET /health` shows rooms, riders, processor and memory; `GET /count?room=indoor:ride:c14` the riders in a room.
