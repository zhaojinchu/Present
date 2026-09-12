# Present

Strava for showing up to class. You check in to each lecture with a photo from inside the room; your circle's shared streak depends on you; skipping posts to the circle and costs you the circle's forfeit.

The full design, team split, hour-by-hour build order and demo runbook are in [PLAN.md](PLAN.md).

## Stack

- Expo SDK 57 (React Native) running in Expo Go, Expo Router, TypeScript
- Supabase: Postgres + RLS, Auth (email/password), Storage (private photos), Realtime (`postgres_changes`)
- No custom server. Skip detection, streaks, forfeits and the feed are all Postgres functions and triggers.

## Setup (one person, ~15 minutes)

1. Create a Supabase project (free tier, `us-east-1`). Then in the dashboard:
   - Authentication → Providers → Email → turn **off** "Confirm email" (sign-up must log in immediately).
   - Integrations → Cron → enable (installs `pg_cron`).
2. Apply the migrations, either
   - with the CLI: `supabase login`, `supabase link --project-ref <ref>`, `supabase db push`, or
   - by pasting each file in `supabase/migrations/` into the SQL editor, in order.
3. Copy `.env.example` to `.env` and fill in:
   - `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (Project settings → API)
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` (seed script only; Connect → Session pooler URI)
4. `npm install` (an `.npmrc` already sets legacy-peer-deps; a transitive react-dom peer range conflicts with React 19.2)
5. Seed the demo data: copy `scripts/seed/schedules.example.json` to `schedules.json`, put the team's real schedules in it, drop a few selfies into `scripts/seed/photos/` named `<first>-1.jpg`, `<first>-2.jpg`, …, then `npm run seed`. It prints the four logins.
6. `npx expo start -c` for local development (Expo Go on a phone on the same network, or press `w` for the browser).
7. `npm run deploy:web` to publish the judge-facing web app to https://present.expo.app (needs `npx expo login`
   once; see KNOWLEDGE.md). The web build is a static export that installs to a phone home screen like an app.

## Scripts

| command | what |
|---|---|
| `npm start` | Expo dev server |
| `npm run typecheck` | app type check |
| `npm run sql:test` | runs the migrations in an in-process Postgres (PGlite) and exercises the whole skip moment, forfeit cap, excuses and RLS. No Supabase needed. |
| `npm run seed` | wipe + rebuild the demo accounts, circle, schedules and two weeks of history |
| `npm run verify` | checks the hosted project end to end: migrations, functions, RLS, triggers, bucket, storage policies, realtime publication, cron jobs. Run after every `supabase db push`. |
| `npm run build:web` | static web export into `dist/` (every route pre-rendered, PWA manifest and icons included) |
| `npm run deploy:web` | export + deploy to production on EAS Hosting (https://present.expo.app) |
| `npm run deploy:web:preview` | export + deploy to a throwaway preview URL |

Setup notes:
- Hosted Supabase rejects made-up email domains on sign-up ("Email address is invalid"). Sign up in the app with a real address (andrew.cmu.edu is fine). The seed accounts (`…@present.demo`) are created through the admin API, which skips that check, and they sign in normally.
- `supabase migration list` and `npm run verify` both need the database password (the CLI prompts; the script reads `DATABASE_URL` from `.env`).

## Layout

```
app/                 Expo Router screens (one folder per owner, see PLAN.md §10)
  +html.tsx          web HTML shell: viewport, standalone-app meta tags, manifest, phone-width column on desktop
  (auth)/            sign-in, sign-up
  (tabs)/            Today (home), Circle (feed), You
  checkin/           camera + geofence + upload
  circle/            create / join
  explain/           explain-yourself modal
  forfeit/           forfeit detail
  schedule/          schedule entry
  dev.tsx            demo controls (5 taps on your avatar in the You tab, EXPO_PUBLIC_DEV_PANEL=1)
components/          UI primitives, feed cards, occurrence card
lib/                 supabase client, session + circle-state providers, api wrappers, geofence, notifications
supabase/migrations/ schema, functions/triggers/RPCs, RLS, dev RPCs, cron/realtime/storage
scripts/             seed.mts, sql-test.mts
public/              copied into the web export as-is: manifest.json and home-screen icons
```

## How the pieces fit

- **State**: one RPC, `get_circle_state()`, returns everything a screen needs (circle, members, streaks, today's occurrences for every member, forfeits, my unexplained skips, last 50 feed events, reactions). `CircleStateProvider` fetches it on mount, on foreground, every 5 s, and 300 ms after any realtime event.
- **Realtime**: one channel per circle on `feed_events` and `reactions` INSERTs. The 5 s poll is the safety net.
- **Check-in**: photo → resize → upload to `checkin-photos/{user}/{occurrence}.jpg` → insert `checkins`. A `before insert` trigger validates the window, flips the occurrence and writes the feed event; its error text is user-facing.
- **Skips**: `detect_skips()` is idempotent and runs from pg_cron every minute, from every client on app open, and from the dev "End window now" button.
- **Streaks**: computed on read (`personal_streak`, `circle_streak`). Excused skips never break them.
- **Notifications**: local only (Expo Go cannot receive remote push since SDK 53). Rebuilt whenever today's pending classes change.

## Demo

Follow PLAN.md §11. Short version: seed 30 min before, all phones on one hotspot, presenter's phone mirrored, dev panel → "Start class now" → three phones check in → "End window now" → the fourth phone gets the explain-yourself prompt → a teammate marks the forfeit paid. Every step has a "Replay" button in the dev panel as a fallback.

One trap: any *real* class in the seeded schedules whose skip deadline passes during the slot becomes a real skip on the projector (cron runs every minute). The seed script warns about classes with deadlines in the next 4 hours. Keep the demo-day schedules clear around the slot, or tap "Can't make it" on those classes beforehand.
