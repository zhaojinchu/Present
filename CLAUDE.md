# Present — notes for Claude Code

Read PLAN.md first: it is the spec (data model, feed payload contract, screen specs, demo runbook). Then KNOWLEDGE.md: current state, decisions, credentials layout, known issues.

## Commands
- `npm run typecheck` — app; `npm run typecheck:scripts` — seed/test scripts
- `npm run sql:test` — migrations + the whole skip moment in PGlite (run after ANY change under supabase/migrations)
- `npm run seed` — rebuild demo data (needs .env with service-role key + DATABASE_URL); `npm run smoke [first]` — sign in as a seed user and validate `get_state()` against the web contract
- `npm run ics:test` — calendar parser against the four fixtures in scripts/fixtures/ics; `npm run ics:fetch [url]` — hit the deployed fetch-ics edge function
- `npm run db:apply` — apply new migration files to the hosted project (records them in the migration history); `npm run verify` — check the hosted shape
- `npx expo export --platform ios --output-dir dist` — Metro bundle check without a phone (delete dist after)
- `npm run web:dev` / `npm run web:build` / `npm run web:typecheck` — the v2 web app in `web/` (Vite); `npm run web:deploy:preview` — preview URL; `npm run web:deploy` — production https://present.expo.app

## Conventions
- v2 (12 Sep 2026): the product is the pure web PWA in `web/` (Vite + React 19 + TypeScript + Tailwind v4 + Motion + react-router + TanStack Query + vaul + react-icons/io5 + vite-plugin-pwa). No Expo modules in `web/`. The Expo tree (`app/`, `components/`, `lib/`) is frozen and will be deleted once the web app is demo-ready; do not edit it.
- Web layout: `web/src/lib/**` logic and hooks (`useAppState`, `useToday`, `useFeed`, `useFriends`, `phaseOf`, `useNow`), `web/src/ui/**` primitives (DESIGN.md scheme A light; tokens in `web/src/styles/tokens.css`), `web/src/app/**` shell and transitions, `web/src/routes/**` screens (thin, hooks only, no Supabase in components), `web/src/mock/state.ts` fixture served when `VITE_MOCK_STATE=1`.
- iOS native-feel rules live in `web/src/styles/app.css` and `web/index.html`: the page never scrolls (one `.scroll-main` per screen), safe areas via `.safe-top`/`.safe-bottom`, inputs at least 16px, `.pressable` on every tappable, no hover-only affordances, tabular digits on counters.
- Time and locale: all timestamps are instants; formatting is pinned to en-US in `web/src/lib/time.ts`; "now" always comes from `web/src/lib/clock.ts` (server offset + dev offset).
- All state comes from one RPC: v2 `get_state()` via `useAppState()` (shape in `web/src/lib/types.ts`, zod-validated). Screens never query tables for feed, streak or occurrence data. Writes go through RPCs (`create_post`, `send_friend_request`, `toggle_reaction`, `add_comment`, `import_classes`, ...); clients never insert into posts, misses, feed_events or class_occurrences.
- Add a feed event type = add it to the enum, the payload contract in the v2 plan (KNOWLEDGE.md points to it), `web/src/lib/types.ts`, and the feed card switch in `web/src/routes/Feed.tsx`.
- Streaks are computed on read (`personal_streak`, `circle_streak`); never store counters.
- Time zone is America/New_York everywhere; timestamps are timestamptz.
- Copy rule: never name the social app this product is modelled on, anywhere (code, comments, copy, docs).
- UI: components/ui.tsx primitives + lib/theme.ts colors. No em-dashes in copy. Screens under a native header (schedule, forfeit, dev) use a plain View, not `Screen` (double safe-area padding otherwise).
- `StyleSheet.absoluteFillObject` no longer exists in RN 0.86; use `StyleSheet.absoluteFill`.
- File ownership for parallel work is by screen (PLAN.md §10). Shared files: lib/*, components/ui.tsx, app/_layout.tsx, app/index.tsx.

## Migrations
- Files apply in order; `20260913000005_supabase_only.sql` (cron, publication, storage) runs only on hosted Supabase. Every time comparison and default uses `public.app_now()` (injectable clock for tests), never `now()` directly.
- Every function is `security definer set search_path = public`; every RPC re-checks `auth.uid()` / `my_circle_id()`.
- Dev RPCs (`dev_*`) live in `20260913000004_dev.sql` and must be dropped before any real release. `supabase/teardown_v1.sql` is a one-shot and is never re-run.
