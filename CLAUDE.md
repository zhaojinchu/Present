# Present — notes for Claude Code

Read PLAN.md first: it is the spec (data model, feed payload contract, screen specs, demo runbook).

## Commands
- `npm run typecheck` — app; `npm run typecheck:scripts` — seed/test scripts
- `npm run sql:test` — migrations + the whole skip moment in PGlite (run after ANY change under supabase/migrations)
- `npm run seed` — rebuild demo data (needs .env with service-role key + DATABASE_URL)
- `npx expo export --platform ios --output-dir dist` — Metro bundle check without a phone (delete dist after)

## Conventions
- Expo Go only (SDK 57). No native modules outside the Expo SDK, no dev builds. Remote push does not work in Expo Go; notifications are local (lib/notifications.ts).
- All state comes from one RPC, `get_circle_state()`, via `useCircleState()`. Screens never query tables for feed/streak/occurrence data.
- Clients never insert into feed_events, skips, forfeits or class_occurrences. Those are written by SQL (triggers, `detect_skips`, RPCs). Add a feed event type = add it to the enum, the payload contract in PLAN.md §2, lib/types.ts, and components/feed/FeedCard.tsx.
- Streaks are computed on read (`personal_streak`, `circle_streak`); never store counters.
- Time zone is America/New_York everywhere; timestamps are timestamptz.
- UI: components/ui.tsx primitives + lib/theme.ts colors. No em-dashes in copy. Screens under a native header (schedule, forfeit, dev) use a plain View, not `Screen` (double safe-area padding otherwise).
- `StyleSheet.absoluteFillObject` no longer exists in RN 0.86; use `StyleSheet.absoluteFill`.
- File ownership for parallel work is by screen (PLAN.md §10). Shared files: lib/*, components/ui.tsx, app/_layout.tsx, app/index.tsx.

## Migrations
- Files apply in order; `20260912000005_supabase_only.sql` (cron, publication, storage) runs only on hosted Supabase.
- Every function is `security definer set search_path = public`; every RPC re-checks `auth.uid()` / `my_circle_id()`.
- Dev RPCs (`dev_*`) live in `20260912000004_dev.sql` and must be dropped before any real release.
