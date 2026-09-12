# Present, working knowledge

Living notes for anyone (person or agent) picking up this project. PLAN.md is the spec; this file is the
state of the world and the decisions behind it. Update it when something here stops being true.

## Decisions (12 Sep 2026)

- **Judges use the hosted web app, not Expo Go.** The app is deployed as a static web build that behaves
  like an installed app (standalone display, home-screen icon, dark status bar, no browser chrome, phone-width
  column on desktop). URL: https://present.expo.app
- **The presenter demos from their own phone via screen share.** No judge has to install anything.
- **Expo Go / EAS Update are gone.** `expo-updates`, the runtime version and update URL were removed. The
  EAS project link (`owner` and `extra.eas.projectId` in app.json) stays only because EAS Hosting needs it.
- **Hosting is EAS Hosting** (Expo's static host). Account `zhaojinc`, project `@zhaojinc/present`,
  project id `f9903b2b-ce3e-4844-8f22-1b5c822cccbc`, subdomain `present`.
  Dashboard: https://expo.dev/projects/f9903b2b-ce3e-4844-8f22-1b5c822cccbc/hosting/deployments

## v2 (approved 12 Sep 2026, ~03:45): pure web PWA, friends, .ics import

Full plan: `~/.claude/plans/ok-well-this-displaying-async-book.md` (read it before any v2 work). Summary: new
`web/` Vite + React + Tailwind + Motion PWA is the whole product (no Expo Go); Supabase stays with a v2 schema
(friends, posts with late/miss, comments, per-user tz, `get_state()`, `create_post`); schedule via .ics import;
class-time posting loop (opens 2 min before, on time until +10, late until 10 after the end, then a miss).
House rule from the user (12 Sep 2026): never mention the app this is modelled on, in product copy, code or docs.
The Expo tree is frozen: no further work there; it is deleted once the web app is demo-ready.

**Design gate (stage 0, 12 Sep 2026 ~03:50).** The design session produced, in the Expo tree: `DESIGN.md`
(scheme A, light), `lib/theme.ts` (tokens), `components/ui.tsx` (primitives), restyled screens and feed
components, a placeholder logo and app icon (black tile, white "P"), and a design canvas at
https://claude.ai/code/artifact/19214626-4f34-49dc-8769-44cc9d6edad5. Decision from the user: **take its
colours and design elements, not its layouts**; screens follow the v2 plan's route tree. What carries over
into `web/`: every colour token (white ground `#FFFFFF`, surface ladder `#F4F4F6` / `#EAEAEE` / `#DEDEE4`,
near-black text `#0A0A0B` at 100/62/42/28%, black accent for actions, ember `#FF6B1F` only for flames,
streak numbers and my reaction, darkened semantics, the dark `capture` palette for the camera flow, six
pastel avatar fills), the type scale (display 44 … label 11 uppercase tracked, weights 400/600/700, tabular
numerals), spacing 4-48, radii 8/12/16/20/pill, sizes, motion timings, and the primitive rules (Txt, Button
variants incl. inverse, Badge soft tints, inverted Chip, StreakChip, Stat, Group/ListRow with inset
hairlines, IconBadge discs, Avatar initials, quote box, reaction pills with `emberSoft` for mine, avatar
status dot, panel layout). Nothing from its screen specs (§5) is used.

**Stage 0 done (12 Sep 2026 ~04:05).** `web/` scaffolded: Vite 8, React 19, TypeScript 6, Tailwind 4 (tokens in
`web/src/styles/tokens.css`), Motion 13, react-router 8, TanStack Query 5, zod 4, vaul, react-icons/io5,
vite-plugin-pwa (own service worker `web/src/sw.ts`). Primitives ported to `web/src/ui/`, shell in
`web/src/app/`, hooks and contract in `web/src/lib/`, fixture in `web/src/mock/state.ts`
(`VITE_MOCK_STATE=1`), every route stubbed under `web/src/routes/`. `web/.env` holds the public Supabase
values (gitignored); `web/.env.example` documents them. Hosting: EAS Hosting accepts the plain static build
(`eas deploy --export-dir web/dist`), so the URL stays https://present.expo.app; latest preview at
https://present--4j9dp5aqpz.expo.app (production https://present.expo.app still serves the v1 Expo build until stage 2). iOS status bar style is `default` (dark text on the white chrome),
not `black-translucent`, because the app is light. Dates and times are pinned to en-US.

**Stage 1 done (12 Sep 2026 ~04:45).** Backend v2 is live on the hosted project. Migrations
`supabase/migrations/20260913000001..05` replace v1 (teardown in `supabase/teardown_v1.sql`, applied once via
`npm run db:apply -- --teardown`). `npm run sql:test` runs 16 v2 cases at a frozen clock (`present.now`) and
passes at any hour. `npm run verify` checks the v2 shape (10 tables, 47 functions, 14 policies, 4 triggers,
storage, realtime on feed_events/reactions/comments/friendships, 3 crons). `npm run seed` builds 4 mutual
friends with 10 class-days of posts, one late post, one explained miss, one excused miss, reactions and
comments (no photos until `scripts/seed/photos/` has files). `npm run smoke [first]` signs in as a seed user
and validates `get_state()` against `web/src/lib/types.ts`. Payload rules that differ from the plan text:
a miss explanation is stored as the author's first comment on the miss event (no `explanation` feed event);
`friends` payload also carries `friend_username`; `dev_end_on_time_now` backdates the cutoff by one second.
Web preview now runs against the real backend (`web/.env` `VITE_MOCK_STATE=0`).

**Stage 2 done (12 Sep 2026 ~05:20): the core loop.** Feed (`web/src/routes/Feed.tsx` + `components/feed/*`):
day sections, PostCard with the second photo inset inside the first (`PostMedia`, tap to swap), Late and
Nearby badges, retake footnote, caption, emoji reactions (optimistic), comment preview and thread
(`/comments/:eventId`), MissCard with the explanation as the first comment and "Explain yourself" for the
misser, excused and friends lines, empty and loading states, the compact prompt bar while a window is open,
"N friends in class now". Today (`routes/Today.tsx` + `components/today/*`): streak hero, PromptCard for
every phase (countdown ring, pulsing post button, late, closed, posted, missed, excused, "Can't make it"),
class rows. Post (`routes/Post.tsx`, `lib/usePost.ts`, `components/post/*`): tap to start the camera,
mirrored front shot, automatic back shot, retakes counted, caption, upload, `create_post` with a
non-blocking GPS fix, success panel with the streak counting up; falls back to a file picker when there is
no camera. Explain (`routes/Explain.tsx`) auto-opens once per session on a new unexplained miss (RootLayout).
Demo controls (`routes/Dev.tsx`): start/end/reset, replay per friend, pin here, clock offset, status.
Production https://present.expo.app now serves the v2 web app. Not yet done: an iPhone Safari camera pass
(needs the user), seed photos, friends/profile/schedule screens (next stage).

**Stage 3 done (12 Sep 2026 ~05:50): people and profile.** Friends (`routes/Friends.tsx`, `components/friends/FriendRow.tsx`):
debounced username/name search with Add/Requested/Accept/Decline by relation, incoming and sent requests, the
friends list as the leaderboard, an onboarding variant with Continue. Share (`FriendsShare.tsx`): QR code and
link (`/add/<username>`), Web Share with clipboard fallback. Add link (`AddFriend.tsx`): signed in sends the
request at once; signed out stores `pending_add` in localStorage (`lib/prefs.ts`), sends after sign-up
(RootLayout). Friend profile (`UserProfile.tsx`): streak, today's classes, last-24-hour posts, remove with
tap-again. You (`You.tsx`): stats, friends/share/schedule rows, memories grid from `get_memories()`.
Settings: name and username (availability check), time zone, sign out. Sign-up checks the username as you
type and records the device tz. Onboarding gate: no classes and not skipped -> `/schedule/import?onboarding=1`
-> friends -> today. Schedule list and manual class form (`Schedule.tsx`, `ScheduleEdit.tsx`; days chips,
native time inputs, free-text room) write the `classes` table under RLS. Calendar import is still a
placeholder screen with "Add a class by hand" and "Skip for now" (next stage). The fixture no longer
auto-opens the explain prompt (`env.mockState` guard) so screens can be screenshotted directly. Not done:
avatar upload (profile photos stay initials), install hint banner, swipe-back.

**Stage 4 done (12 Sep 2026 ~06:25): calendar import.** Parser in `web/src/lib/ics/` (no dependencies):
`parse.ts` (RFC 5545 unfolding, params with quotes, text unescaping, multi-value EXDATE/RDATE, nested
VTIMEZONE/VALARM skipped, X-WR-TIMEZONE), `tz.ts` (IANA passthrough, Windows names, UTC to local wall clock),
`course.ts` (course code + kind from SUMMARY: 15-122, CS 61A, MATH 1A, COMP 110, 6.006), `toClasses.ts`
(weekly-only drafts with term bounds from UNTIL/COUNT/16-week default, exception dates incl. moved sessions,
one-offs offered unchecked, all-day/long/non-weekly left out with reasons, sibling merge for
one-event-per-weekday feeds, stable joined uids). `npm run ics:test` runs 9 cases over four fixtures in
`scripts/fixtures/ics/` (CMU SIO, Google, Outlook CRLF+COUNT+DURATION, Apple floating/UTC). Screen
`routes/ScheduleImport.tsx`: file picker, drop zone, paste (link or contents), review list with include
toggles and a per-row edit sheet, "left out" list, `import_classes` write, onboarding variant with skip.
Links go through the Edge Function `supabase/functions/fetch-ics` (deployed 12 Sep 2026, verify_jwt on;
https only, private hosts blocked, 3 redirects, 10 s, 2 MB, must start with BEGIN:VCALENDAR);
`npm run ics:fetch [url]` exercises it as a seed user. Re-import is idempotent by (user, ics_uid).

**Stage 5 done (12 Sep 2026 ~06:45): polish.** Profile photos: public `avatars` bucket
(`supabase/migrations/20260913000006_avatars_supabase_only.sql`, upload into own folder), client resizes to
256x256 JPEG and saves the public URL on the profile (`web/src/lib/api/profile.ts`, Settings "Change
photo"). `components/InstallHint.tsx`: one-line hint on iOS Safari when not installed, dismissible. Edge
swipe from the left pops pushed screens (`app/StackTransition.tsx`). Re-tapping the active tab scrolls to
the top and refreshes the state. Not built, by decision: Web Push. It needs a VAPID key pair whose private
key must be stored as an Edge Function secret in the Supabase dashboard (no CLI here), an Edge Function
`send-push`, and a per-minute cron via pg_net with a service key in Vault; the service worker already has
the `push` and `notificationclick` handlers and the `push_subscriptions` table and RPCs exist.
Still on the user: seed photos in `scripts/seed/photos/` then `npm run seed`, the iPhone Safari pass,
deleting the frozen Expo tree once the phone pass is clean, and a first commit.

**Stage 6 done (12 Sep 2026 ~07:20, design session): the social layer before the miss.** Four features on
top of v2, chosen to widen the gap from the app this is compared to (everything there happens after the
photo; everything here happens before). Backend: `supabase/migrations/20260913000007_social.sql` (applied to
hosted) adds `feed_type` values `heading_out` and `nudge` and three RPCs, all plpgsql, `app_now()`,
security definer, explicit grants: `head_out(p_occurrence_id)` ("Leaving now", one per occurrence, from 45
min before class until the deadline, idempotent), `nudge(p_occurrence_id)` (poke a friend whose class is
pending, from 15 min before until the deadline, once per friend per class, payload carries `target_id` /
`target_name` / `target_username` / `target_avatar_url` / `deadline`, `ref_id` = target), and `get_stats()`
(week from Monday in my tz plus term totals for me and every friend: on time / late / missed / excused /
upcoming, minutes in class, best streak; a pending occurrence past its deadline counts as missed before
`detect_misses` runs). Tests: `scripts/sql-test-social.mts` (3 cases, run by `npm run sql:test`). Client:
`web/src/lib/presence.ts` (pure helpers: `groupPosts`, `headingOutFor`, `nudgesForMe`, `pendingFriendsFor`),
`web/src/lib/api/presence.ts` (`headOut`, `nudge`, `getStats` with zod), `components/feed/TogetherDeck.tsx`
(posts from one class session become one swipeable Motion card stack; tap the right third for next; reactions
and comments follow the top card; grouping is client-side in `FeedList` via `groupPosts`),
`components/feed/PresenceLines.tsx` (feed lines for the two new types), `components/today/HeadingOutRow.tsx`
and `NudgeRow.tsx` (under the Today hero; the nudge row also sits under the compact prompt on the feed),
`components/NudgeBanner.tsx` (mounted in `RootLayout`; a nudge aimed at me shows a fixed banner with the
countdown and a Post button, vibrates once, hides on `/post/*`, when I post, or when dismissed),
`components/you/WeekStats.tsx` (the "This week" card on You with the friends leaderboard). `FeedType` in
`web/src/lib/types.ts` includes the two values; the mock fixture has a nudge aimed at me, a heading-out line
and two posts sharing a session so the deck renders under `VITE_MOCK_STATE=1`. Demo beats this enables:
"Leaving now" before the window, a nudge to the friend who has not posted, three friends in one deck, then
the miss. Also (~07:50): swiping between the three tabs. `web/src/app/StackTransition.tsx` now owns two
gestures: on a tab route a horizontal touch swipe (64 px, or fast) moves to the neighbouring tab in
`TAB_ORDER` and navigates with `state.tabSwipe = ±1`; tab screens are keyed by pathname and slide in that
direction (both screens move) when the change came from a swipe, and crossfade as before on a tab-bar tap.
Direction lock after 10 px; touches that start inside `.overflow-x-auto`, `[data-swipe-ignore]` (the together
deck) or a form control are ignored; the left-edge pop on pushed screens is unchanged. Testing note: Motion
animations freeze when the browser tab is hidden (`document.visibilityState`), so a headless-looking Chrome
window shows screens stuck at opacity 0; bring the tab to the front before judging a transition.

**Saturday test calendar (12 Sep 2026 ~04:50).** No real classes on the hackathon day, so `web/public/play-saturday.ics`
(and a `.txt` copy for browsers that download `.ics`) holds 38 one-day slots on 2026-09-12, 05:00 to 23:30
America/New_York every 30 min, 20 min each, `SAT HHMM Saturday test slot`, `RRULE ... UNTIL=20260912` so nothing
lingers. Served by production at https://present.expo.app/play-saturday.ics (Vite copies `public/` into `dist/`,
so it survives rebuilds); the fetch-ics function accepts it. Import via You → Schedule → Import from calendar →
paste the URL. Windows: opens :58/:28, on time for 12 min, late until the next slot starts, so a slot is always
open from 04:58 to 23:50. The four seed accounts already have it imported (41 classes each); `npm run seed`
replaces that. Delete the SAT classes from the Schedule screen to remove it from a real account.

**File ownership for v2** (claim a line here before editing): `web/src/lib/**`, `web/src/routes/**`,
`web/src/app/**`, `supabase/**`, `scripts/**` = this (logic) session. `web/src/ui/**`, `web/src/styles/**` =
design session if it continues; otherwise this session. Shared: `web/src/lib/types.ts`, `KNOWLEDGE.md`.

## Backend state

- Supabase project ref `qpybcvdzlhfantugrgty`, URL `https://qpybcvdzlhfantugrgty.supabase.co`, region us-east-1.
- v2 schema applied 12 Sep 2026 (see "Stage 1 done" above). `npm run verify` passes.
- Seeded 12 Sep 2026 ~04:40 from `scripts/seed/schedules.example.json` (no custom schedules, no photos yet).
  Re-seed after adding `scripts/seed/schedules.json` and selfies in `scripts/seed/photos/`. Leaderboard:
  alex 10, jordan 10, priya 10, sam 7. Demo course 15-122. Usernames = first names.
- Demo logins (password `present-demo-2026` for all): alex@present.demo (streak 10), sam@present.demo (8),
  priya@present.demo (10), jordan@present.demo (10).
- Not yet confirmed in the dashboard: Authentication, Providers, Email, "Confirm email" must be OFF for
  fresh sign-ups to log in. Seed accounts are pre-confirmed so they work regardless.
- The Supabase MCP server is configured in `.mcp.json` (project-scoped, no secrets). It can run SQL,
  list tables, read logs and advisors against the hosted project.

## .env (never committed)

| key | what | gotcha |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | project URL | baked into every web and native bundle |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_...` key | public by design |
| `SUPABASE_URL` | same URL, for scripts | |
| `SUPABASE_SERVICE_ROLE_KEY` | `sb_secret_...` key (Project Settings, API Keys, Secret keys) | the publishable key does NOT work here; seed needs admin API |
| `DATABASE_URL` | Session pooler URI, port 5432 | remove the template's `[ ]` around the password; URL-encode `!` `@` `#` etc. |
| `EXPO_PUBLIC_DEV_PANEL` | 1 shows the demo panel (5 taps on avatar) | |
| `EXPO_PUBLIC_REQUIRE_GEOFENCE` | 1 blocks check-ins outside seeded buildings | use dev panel "Set demo building to my location" when demoing elsewhere |

Verified on 12 Sep 2026 that the exported bundles contain only the public URL and publishable key; the
secret key and database URL are not in them.

The v2 web app reads `web/.env` instead: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (same public values),
`VITE_MOCK_STATE` (1 = fixture, no backend), `VITE_DEV_PANEL`, `VITE_APP_URL`. Also gitignored.

## Web build (v1 Expo export; superseded by `web/`, kept until the Expo tree is deleted)

- `app.json` `web.output` is `static`: every route is pre-rendered to its own HTML file at export time,
  running the app once in Node. Code that touches `window` at render or module scope breaks the export.
  `lib/supabase.ts` wraps AsyncStorage for this reason.
- `app/+html.tsx` is the HTML shell: viewport with `viewport-fit=cover` and `maximum-scale=1`,
  `apple-mobile-web-app-capable`, `theme-color`, manifest and apple-touch-icon links, and CSS that kills
  overscroll and shows a 430 px phone column on screens wider than 600 px.
- `public/manifest.json` and `public/icons/*` are copied verbatim into the export root.
- Platform-specific files: `lib/notifications.web.ts` (all no-ops; browsers cannot schedule local
  notifications) and `components/WebHead.web.tsx` (document title). Metro picks `.web.ts(x)` on web.
- Camera, location, image resize and upload all have web implementations in the Expo SDK, and need HTTPS,
  which the host provides. The check-in flow still needs a real test on an iPhone in Safari.
- Commands: `npm run build:web` exports to `dist/`; `npm run deploy:web` exports and deploys to
  production; `npm run deploy:web:preview` gives a throwaway preview URL. `eas-cli` is a devDependency.

## Known issues

- `npm run sql:test` is time-of-day dependent: two assertions assume it runs after 04:00 America/New_York
  (a "3am class already missed" fixture and a "two hours ago" occurrence that lands on yesterday before
  02:00). It passes after 4am; the SQL is correct.
- A UI restyle (`components/ui.tsx`, `lib/theme.ts`, feed and streak components, DESIGN.md) was in progress
  on 12 Sep 2026 with `npm run typecheck` failing in several of those files. The 02:45 EDT production deploy
  captured that in-progress state; run `npm run deploy:web` again once the restyle type-checks.
- Expo Go 57 on iOS requires the phone and the terminal to be logged into the same Expo account to open a
  dev server. That is why Expo Go was dropped for judges.

## Demo network

- CMU-SECURE blocks phone-to-laptop traffic, so `expo start` QR codes do not work there. The hosted web app
  and Supabase are both on the public internet and work on any network including cellular.
