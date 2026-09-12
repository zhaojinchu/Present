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

**Stage 6 revised (12 Sep 2026 ~08:10).** The user cut Nudge and Heading out ("fluff and clutter; the goal is
attending class"). Migration `20260913000008_drop_presence.sql` drops `head_out` and `nudge` and deletes their
feed rows (the enum values stay; the client still lists them in `FeedType` and renders them as nothing). The
components, hooks, mock events and the two sql-test cases are gone; `get_stats()`, `WeekStats`, the together
deck and the tab swipe stay. The Feed header now reads "Present". Next: a Groups feature (see the user's
brief in the design session transcript); each post is to be called a "present" in copy.

**Stage 6 done (12 Sep 2026 ~07:20, design session): the social layer before the miss.** (Superseded above
for nudge and heading out.) Four features on
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

**Photos, camera and post flow (12 Sep 2026 ~10:30).** Photo loading was slow because every image paid a
`createSignedUrl` round trip, then a CDN miss (each token is a new cache key) with no cache headers, and an
in-memory cache that died on reload. Now `web/src/lib/api/post.ts` signs in one `createSignedUrls` batch per
tick (TTL 7 days, map persisted in `localStorage` key `present.photo_urls.v1`, `peekSignedUrl` for a sync hit,
`prefetchSignedUrls` called from `fetchState` for every path in the state), `web/src/app/Photo.tsx` exports
`CachedImg` (`crossOrigin="anonymous"`, `loading="lazy"`, `decoding="async"`, `fetchPriority` high when
`eager`; storage answers `access-control-allow-origin: *` so CORS mode is safe), `PostMedia` takes `eager`
(first feed card), and `web/src/sw.ts` caches `/storage/v1/object/` images CacheFirst in `present-photos-v1`
with the `token` query dropped from the key (400 entries, 30 days). Measured before: sign ~150 ms each in
series + ~400 ms cold fetch per image; a warm CDN hit is ~60 ms and the service worker serves repeats locally.
Post flow: the success screen now returns to the feed after 2.2 s (the timer was re-armed every second by
the clock re-render because `useInvalidateState` returns a new function per render; it is keyed on the
stage only now) and any tap on it leaves at once. Camera: no "tap to start" any more; `usePost` starts the
camera itself once the occurrence is known (`autoStarted` ref), `idle` shows the spinner, a denied
permission shows "Camera access is off for Present..." with Try again and the photo picker.
`web/index.html` also carries `mobile-web-app-capable` next to the Apple meta.

**Stage 7 backend (12 Sep 2026 ~11:15): groups.** `supabase/migrations/20260913000009_groups.sql` (+
`000010_groups_supabase_only.sql` for the publication), applied to hosted. Tables `groups` (name, emoji,
`invite_code` 6 chars no 0/O/1/I, `forfeit_text`, created_by), `group_members` (max 8, enforced in the
RPCs), `group_forfeits` (owed | paid | voided), `miss_votes`, `miss_vouches`; RLS = member of the group via
`my_group_ids()`. `visible_users()` = me + friends + `group_mates()`, so co-members' classes, posts, misses
and photos flow through every existing policy and `get_state()`; the friends list uses `friends_of()` only.
RPCs: `create_group`, `join_group(code)` (anyone, idempotent), `add_to_group` (friends only), `leave_group`
(last one out deletes), `update_group` (creator; empty emoji/forfeit clears), `mark_forfeit_paid` (not the
ower), `vote_miss` (fair votes > (members - 1) / 2 excuses for the group), `vouch_miss` (one vouch excuses),
`group_state`. Trigger `misses_group_effects`: a new unexcused miss owes the forfeit in each group with a
forfeit_text; any excuse (own, vote, vouch) voids it. `group_streak` / `group_best_streak` over all
occurrences of current members by date (broken: unexcused miss or pending past deadline; complete: all on
time / excused / group-excused; late or pending leaves the day undecided). `get_state()` adds `groups[]`
(members with personal streak + posted_today, streak, best_streak, week made/total/on_time/late/missed/
upcoming where total = made + missed, standings over the term, forfeits/votes/vouches/excused_miss_ids for
misses of the last 14 days) and `shared_courses[]` (my active courses that at least one friend also has).
Tests: `scripts/sql-test-groups.mts` (7 cases, part of `npm run sql:test`). Client: the five tables are on
the realtime channel in `appState.ts`; `types.ts` imports the peer's `web/src/lib/groups.ts` schemas.
The Saturday test slots were removed from the four seed accounts again (their misses were wrecking the
seeded streaks and feed); real accounts keep theirs.

**Stage 7 UI (12 Sep 2026 ~11:40, design session): groups, all seven mechanics, for the user to rate.**
Contract in `web/src/lib/groups.ts` (zod `Group`, `SharedCourse` + pure helpers `rollCall`, `sortedStandings`,
`missInGroup`, `eventsForGroup`, `groupsSharedWith`); writes in `web/src/lib/api/groups.ts` (one `rpc()` that
logs and resolves in mock mode). `AppState` gained `groups` and `shared_courses` with `.default([])`. Screens:
`/groups` (list, schedule suggestions from `shared_courses`, New / Join), `/groups/:id` (GroupCard hero: group
streak in ember or "Streak lost · everyone starts over" in red, best, members, this week; roll call today;
standings with a trophy and the bottom row in danger-soft when it has misses; stakes with "Mark paid";
members; add friends (max 8); invite code with share/copy; leave with tap-again confirm), `/groups/new`
(name, emoji chips, stakes presets + custom + none, friend picker; prefilled by `?name=&members=` from a
suggestion), `/groups/join?code=` (auto-submits from a link). Feed: `GroupChips` row (All, one chip per
group, a people icon to /groups); with a group selected the feed is `eventsForGroup`, a compact `GroupCard`
strip and the one roll-call session that matters now sit above it, and every miss by a member gets
`GroupMissActions` (owes / paid / waived line, Fair enough / Not buying it with counts, I saw them; the misser
sees "n of needed say fair enough"); in the All view each miss gets one summary line per shared group. The
chip selection lives in a module variable so it survives tab swipes. You tab: Groups row; "Posts" stats are
now "Presents"; PromptCard says "Present from 15-122" / "Present late". Mock fixture: "Hack House" (streak 0,
best 12, Sam owes boba on `miss-1`, one fair one unfair vote) and "15-122 gang" (streak 3), `shared_courses`
21-241 with Sam and Jordan. Verified on the mock in Brave (all screens, no console errors); deployed to
production together with the peer's realtime-channel change. PITCH.md demo beats now use the group. After
the peer's UI round, Standings, Stakes and RollCall wrap avatars/names in `ProfileLink` (deployed ~12:10).

**UI round (12 Sep 2026 ~12:15): six fixes from the user.** (1) TogetherDeck swipe: threshold 40 px or a
sixth of the card, velocity 240, mostly-horizontal check, `dragDirectionLock`, no momentum, so a slow
deliberate swipe registers. (2) Today: the classes list shows ten rows centred on what is still to come;
finished rows collapse behind "Show N earlier", the tail behind "Show N more" (`splitRows` in
`routes/Today.tsx`). (3) The "N friends are in class now" row sits directly under the date on Today.
(4) "Can't make it" is public: `20260913000011_excuse_reason.sql` replaces `excuse_occurrence(uuid)` with
`excuse_occurrence(uuid, text)` (reason required, stored as the miss explanation, carried as
`payload.reason` on the excused event, streak still stays) and `excuse_miss(uuid, text default null)`
(optional reason becomes the first comment under the miss and rides on the excused event);
`on_miss_update` adds `reason` and `starts_at` to the excused payload. Client: `PromptCard` opens a Sheet
that requires the reason ("Announce it"), `ExcusedLine` shows "X can't make 15-122" with the reason in a
Quote, `Explain` passes the typed text along with "It was sick or an emergency". `FeedPayload` gained
`reason`. (5) Miss card: a plain second line ("Sam didn't show up and hasn't said why." / "Everyone can
see this." for the misser), "No excuse yet. Reply" under it; the Late chip now sits on the photo itself
(`PostMedia late` prop, used by PostCard, TogetherDeck and the posted PromptCard). (6)
`components/ProfileLink.tsx`: any avatar or name opens /u/:username (or /you for me) with propagation
stopped; used in PostCard, MissCard, ExcusedLine, FriendsLine, LiveRow, Comments. Group screens still use
plain Avatar (present-bb offered to switch them).

**Stage 7 revised (12 Sep 2026 ~12:40): groups are now circles of people.** The user found the class-based
framing unintuitive ("it should be groups of PEOPLE, shouldn't be related to classes... rename it to circle")
and the feed chip row too tall on a phone. UI renames only; the database and `get_state().groups` keep the
group names (`web/src/lib/groups.ts` says so at the top). Files moved: `web/src/components/circles/`
(CircleCard, CircleMissActions, CirclePicker, RollCall, Standings, Stakes; GroupChips and SuggestedGroups
deleted) and routes `Circles.tsx`, `CircleDetail.tsx`, `CircleNew.tsx`, `CircleJoin.tsx` at `/circles`,
`/circles/:circleId`, `/circles/new`, `/circles/join?code=`. `shared_courses` is no longer read by the UI
(still in the contract with a default). The Present top bar has a circles icon (IoPeopleCircle, filled when
a circle is selected, badge = number of circles) that opens a vaul sheet "Show presents from": Everyone,
each circle with its streak chip, then Manage circles (or Make a circle when there are none). Picking one
filters the feed and shows the compact circle strip + live roll call as before. Create flow is name, emoji,
stakes, invite friends; join is by code. Copy: "circle streak", "owes the circle", "Invite", presets start
with "buys everyone boba". Roll call stays but only renders when two members share a class today. Mock
circle 2 is "Coffee crew" ☕. Deployed to production; PITCH.md updated to the picker and circle wording.

**Push notifications and QR scanner (12 Sep 2026 ~13:30).** Web Push is live. Backend:
`20260913000012_push.sql` adds `push_queue` (RLS, no policies: clients never read it; `tag` unique so
nothing is announced twice) and the triggers that fill it: friend request (to the other person),
accepted request (to the requester), a miss (to the misser, url /explain/<miss>), a comment on your post
or miss, and `enqueue_open_windows()` (class window opened in the last 3 minutes, url /post/<occ>).
`000013_push_supabase_only.sql`: `pg_net`, Vault-backed `push_secret()` / `push_public_key()`
(authenticated) / `push_secrets()` (service role), `push_kick()` posts queue ids to the send-push
function with the `x-push-secret` header, `push_queue_kick` trigger (immediate) plus crons
`present-push-open-windows` and `present-push-drain` every minute (retry unsent, 3 attempts).
`000014_push_test.sql`: `push_test()` sends yourself a test notification (called right after enabling).
Secrets live in Supabase Vault, written by `npm run push:setup` (`scripts/push-setup.mts`: VAPID keys,
hook secret, function URL; idempotent). Edge function `supabase/functions/send-push` (verify_jwt off,
secret header is the auth; `npm:web-push`; drops 404/410 subscriptions; marks rows sent). Pipeline was
tested end to end on hosted (trigger → pg_net → function → row sent in 6 s); real delivery to a phone is
not yet confirmed. Client: `web/src/lib/push.ts` (`pushStatus`, `enablePush` from a tap, `disablePush`,
`syncPushSubscription` on sign-in from RootLayout), `components/today/NotifyCard.tsx` (one-time card on
Today; on iOS Safari it says to install first), Settings "Notifications" row (toggle + status), `sw.ts`
already had the push and click handlers. iOS: Home Screen app only, 16.4+. Test: `scripts/sql-test-push.mts`
(2 cases, in `npm run sql:test`). QR scanner: `routes/ScanQr.tsx` at /friends/scan (environment camera,
BarcodeDetector when present else `jsqr`, accepts any host's /add/<username> link, an @handle or a bare
username, then navigates to /add/<username>); buttons in the Friends header (scan icon next to share) and on
the Share screen. Circles: present-bb renamed the groups UI to Circles (routes /circles/...), removed the
class-based suggestions; the backend still calls them groups and get_state keeps `shared_courses` (unused).

**Pull-to-refresh and haptics (12 Sep 2026 ~14:00).** `web/src/lib/haptics.ts` exports
`haptic('light' | 'medium' | 'success' | 'error')`: `navigator.vibrate` where it exists (Android), else the
iOS trick of clicking a hidden `<input type="checkbox" switch>` (plays the system switch haptic on iOS
17.4+ when called inside a user gesture); safe anywhere, silent where unsupported. Used on: tab taps,
pull-to-refresh arm (light) and fire (medium), the shutter (medium), post success (success), reaction
toggle (light), friend request/accept (success), "Announce it" (success). Pull-to-refresh lives in
`AppShell.tsx` `Main` (touch listeners on `.scroll-main`, content translates with the pull, spinner above;
arms at 64 px, holds at 56 px while `invalidate()` runs, min 500 ms; `refresh={false}` opts a screen out).
`.scroll-main` is now `overscroll-behavior: none` so the container does not rubber band on top of it.
Today: "Show N earlier" / "Show N more" toggle back to "Hide earlier" / "Show less". The circle strip in
the feed and the roll-call collapse were handed to present-bb with the user's wording.

**Stage 7 tidy (12 Sep 2026 ~13:20).** User: the circle banner on the feed was "too much information" and roll
call needed a fold. Feed strip with a circle selected is now one 56px row (emoji, name, one footnote line:
the class that matters now as "15-122 now · 2 of 4 present" / "21-241 at 9:30 · 2 of you" / "… made it",
else "21 of 29 this week"; streak chip; chevron) and it replaces the LiveRow while a circle is selected, so
the first post's photo is mostly on screen at phone height. `RollCall` folds to the session that matters now
(`rankRollCall` / `sessionPhase` / `presentCount` in `lib/groups.ts`) with "Show N more classes" / "Show
less", no inner scroll. Haptics from the peer's `lib/haptics.ts`: light on deck paging, light on tap and
success/error on vote, vouch and paid. Mock gained `occ-priya-241` so the fold has something to hide.
Copy pass (~13:50, user: "remove the grey background behind the text… remove any filler text"): the circle
verdict under a miss is no longer a grey box; the streak label is just "Circle streak" / "Streak lost";
the Circles intro paragraph, invite-code footnote, join hints, stakes explainer and "no verdict yet" line
are gone; `SharedCourse` / `shared_courses` removed from `lib/groups.ts`, `types.ts` and the mock (the
peer dropped it from get_state). Mock note: the fixture's 15-122 is always open, so the feed and circle
routes show the lock screen in mock mode even with a dev clock offset; screenshot Today or edit the fixture.

**In-class lock and push/pop transitions (12 Sep 2026 ~14:40).** Product decision: while one of my
classes is open or late and unposted, the app is for posting, not browsing. `web/src/lib/lock.ts`
(`useInClassLock(nowMs)`: first of my occurrences in phase open, else late; `lockAllows(pathname)`: /today,
/post/*, /explain/*, /settings, /dev, /schedule*, /sign-in, /sign-up, /add/* stay reachable),
`web/src/app/LockGate.tsx` (sits where StackTransition was in RootLayout; ticks every 5 s; renders
`components/LockScreen.tsx` for any other route; toggles `body.app-locked`, which `app.css` paints with
`filter: grayscale(1)` and a 480 ms transition, lifted on the camera route so the preview is in colour;
sheets are in portals under body so they go grey too). The lock screen is the Present header, a lock disc,
"You're in 15-122 / Present first. The feed unlocks the moment you do." (late variant), the full PromptCard,
and "Everything stays grey until then." The open and late PromptCards gained a tertiary "Can't make it"
(the public reason sheet) so there is an honest way out; posting, excusing, or the deadline lifts the lock.
Push/pop fix in `StackTransition.tsx`: `useNavigationType()` decides the direction; a push slides the new
screen in from the right over the old one receding 24 %, a pop slides the top screen out to the right with
the one beneath coming back (zIndex in the variants); `custom` is now `{ tab, push }`. This fixed the odd
"+ New circle" animation where both screens moved right.

**Live profiles on feed events, cleaner copy (12 Sep 2026 ~15:10).** `20260913000015_live_profiles.sql`
replaces `get_state()` once more: every feed event's payload is overlaid with the actor's current
display_name, username and avatar_url (payloads are still written once with `profile_json`, so old posts
used to keep the old photo), and `shared_courses` is gone from get_state (the client field has a default;
`SharedCourse` in lib/groups.ts is now unused). Copy: the capture-preview caption sits straight on the
photo (transparent, centred, text shadow) instead of in a translucent box; the excused line shows the reason
as plain secondary text, no Quote box, no "Streak stays."; the excused PromptCard is just its header; the
late card says "Doesn't count for your streak."; closed says "Window closed. Say why, or it counts as a
miss."; the lock screen, Explain, You and Share lost their footnotes.

**Any-emoji reactions, leaner You (12 Sep 2026 ~15:40).** `ReactionBar` no longer has a preset row:
pills come from the reactions that exist (grouped by emoji, count, mine in ember), and a smiley button opens
a 16 px text input (no Safari zoom) where the system keyboard's emoji board supplies the reaction;
`firstEmoji()` takes the first grapheme that is Extended_Pictographic or a regional indicator, at most 8
code points (the server's limit), letters are ignored. `REACTION_EMOJI` / `ReactionEmoji` left config.ts.
You: the big streak / best / presents row between the avatar and the "This week" card is gone (the card
already shows them); the only footnote is "Presents are kept for 30 days."

**Profile links everywhere, live photos in the leaderboard (12 Sep 2026 ~16:00).** `get_stats()` returns
`me` without a name or photo, so the "Among friends" rows in `components/you/WeekStats.tsx` showed a "?"
avatar for me and a stats-time snapshot for friends; the rows now take display_name, username and
avatar_url from the live state (`me` and `friends` in get_state) and each row is a `ProfileLink`.
`components/ProfileAvatarStack.tsx` is the clickable twin of `AvatarStack` (each face opens /u/:username);
used in the TogetherDeck header ("Sam and Priya are in 15-122") and the PromptCard "N friends posted" line.
`CircleCard` and `PostSuccess` still use the plain stack on purpose (a summary, and a screen that
auto-closes). The web build runs `tsc -b` first, so a type error stops the deploy rather than shipping.

**The blocker (12 Sep 2026 ~16:30).** The lock screen is now a full-screen single-colour page,
`components/LockScreen.tsx`: `#1C1C1F` ground, `#F2F2F5` text, no header, no tab bar; "IN CLASS" (or
"LATE"), the course code at 40 px, "Present to unlock." (late: "Present late to unlock."), a live
countdown line, one white "Present" button (slow `.lock-pulse` scale, off under reduced motion) and a
quiet "Can't make it" text link that opens the shared `components/today/ExcuseSheet.tsx` (extracted from
PromptCard, which now uses it too). `lib/lock.ts` ALLOWED shrank to /post/*, /explain/*, /dev, auth and
/add/*, so Today, Settings and Schedule are blocked as well while a window is open; the dev panel stays
reachable for the demo. Body grayscale still applies underneath (irrelevant on the dark page, needed for
sheets). Dark page into the dark camera reads as one flow.

**Emoji board for reactions (12 Sep 2026 ~16:50).** A web page cannot open the iPhone keyboard's emoji
pane, so the smiley button on a post now opens `components/feed/EmojiSheet.tsx`: a Sheet hosting the
`emoji-mart` web-component Picker (core package only; `@emoji-mart/react` pins React 16-18 so it is not
used) with `@emoji-mart/data`, `set: 'native'` (Apple glyphs on iOS), search, categories, skin tones, two
rows of frequently used. Both load lazily on first open (separate chunks), styled through the picker's CSS
variables to the app palette. Picking toggles the reaction and closes the sheet. The typed-emoji input from
earlier in the day is gone.

**Settings account rows, circle admin RPCs (12 Sep 2026 ~17:15).** Settings "About" became "Account":
"Signed in as" shows the session email; "Time zone" shows the profile zone with "from this phone", or, when
the phone's `Intl` zone differs, "this phone is on X" with a "Use phone" action that calls update_profile
(p_tz). `20260913000016_circle_admin.sql`: `remove_from_group(p_group_id, p_user_id)` (creator only, not
yourself, returns the group object) and `delete_group(p_group_id)` (creator only, cascades); tested in
sql-test-groups (8 cases now), applied to hosted. present-bb owns the circle-detail UI changes the user
asked for (no invite code on the page, person-plus icon for adding, stakes without the "nobody owes"
line, an ellipsis/edit sheet with remove member / delete / leave, no repeated avatars).

**Emoji sheet scroll and real "frequently used" (12 Sep 2026 ~17:30).** The vaul drawer treated touches
inside the picker (a shadow-DOM web component, so its inner scroller is invisible to the drawer's
scrollable check) as sheet drags; `EmojiSheet` now stops pointer and touch propagation at the picker host
and sets `touch-action: pan-y`, so the board scrolls and the sheet still closes from the handle or scrim.
"Frequently used" is seeded from the person's actual reactions in the current state (native emoji mapped
to emoji-mart ids, written into `localStorage['emoji-mart.frequently']`, max-merged with what the device
already counted); `ReactionBar` passes `history`. Note: `npm run web:build` runs `tsc -b` first, so a
half-finished edit anywhere in `web/src` (either session) blocks both sessions' deploys; production keeps
the last good bundle.

**Stage 7 manage (12 Sep 2026 ~14:40).** User: no invite code on the circle page, person-plus instead of
share, no "nobody owes" line, easy member removal and editing, no repeated faces. `/circles/:id` is now
hero card (streak, best, "21 of 29 this week"; no avatars), roll call (folded), "Members · this week"
standings, stakes (section hidden when there is no stake and nothing owed). Header: person-plus →
`/circles/:id/invite` (`routes/CircleInvite.tsx`: friends not yet in, Invite per row, then the code with
Share; the only place the code shows), ellipsis → `ManageSheet` in `CircleDetail.tsx` (creator: "Name,
emoji and stakes" → `/circles/:id/edit` (`routes/CircleEdit.tsx`, always sends all three fields because
update_group clears nulls), Invite friends, members with tap-again "Remove" per row, "Delete circle";
member: Invite friends, members, "Leave circle"). `components/circles/CircleFields.tsx` holds the emoji and
stakes pickers shared by New and Edit. API: `removeFromGroup`, `deleteGroup` (peer's migration 000016).
Verified on the mock by temporarily marking the fixture's 15-122 as posted (reverted) to get past the lock.

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
