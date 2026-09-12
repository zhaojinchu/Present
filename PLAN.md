# Present — HackCMU 2026 build plan

## 1. Assumptions

- Hackathon is 24 continuous hours; all hours below are relative to kickoff (H0).
- **One circle per user in v1.** Enforced by a unique index on `circle_members.user_id`. Schema still supports many later.
- Time zone is fixed to `America/New_York` for all schedule math. No DST edge falls in the hackathon weekend.
- A "class-day" for a user is a date with ≥1 class occurrence. Days with no classes neither extend nor break streaks.
- Days where only some circle members have classes count toward the circle streak if those members attended. A day with only excused skips counts as attended.
- Occurrences are per user, per class, per day. Four teammates in the same course are four occurrence rows with identical `starts_at`.
- Auth is Supabase email + password with email confirmation disabled. Seed accounts have known passwords. No magic links (deep links in Expo Go are a time sink).
- Circles are joined by a 6-character invite code typed in, not a link. No leave/kick in v1.
- Forfeit presets: "buys the circle boba", "does the dishes", "posts a photo the circle picks", "cooks dinner for the circle", plus custom text. Stored as plain text on the circle.
- Excused skips can be set pre-emptively (Home screen, before the deadline) and after the fact (from the explain-yourself modal). After-the-fact excuse voids an unpaid forfeit.
- Reactions are a fixed emoji set (🔥 😂 🫡 💀 🧋), one per user per emoji per event.
- Check-in always requires a photo. Front camera by default. Dual capture is sequential (front, then back) behind a feature flag; decide by H12.
- Photos go to a private Storage bucket and are rendered via signed URLs (1h). Read access is "any authenticated user" in v1; circle-scoped storage policy is a post-hackathon tightening.
- The dev panel ships in the demo build (it is Expo Go anyway), gated by a build-time flag plus 5 taps on the profile avatar.
- The demo skipper is a real teammate account. "Alex" and "Sam" below are placeholders.
- Supabase free tier, one shared project, `us-east-1`. Anon key lives in the app `.env`; service-role key lives only in the seed script `.env`, never committed.
- Demo network is a phone hotspot, not venue wifi. All 4 phones and the laptop join it.

## 2. Data model

All tables in `public`, RLS enabled on every table. `profiles` mirrors `auth.users` via the standard trigger.

```sql
create extension if not exists pg_cron;

create type occ_status     as enum ('pending','checked_in','skipped','excused');
create type forfeit_status as enum ('owed','paid','voided');
create type feed_type      as enum ('checkin','skip','excused','explanation',
                                    'forfeit_owed','forfeit_paid','member_joined');

create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

create table circles (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  forfeit_text text not null,              -- preset label or custom text
  invite_code  text not null unique,       -- 6 uppercase chars
  created_by   uuid not null references profiles(id),
  created_at   timestamptz not null default now()
);

create table circle_members (
  circle_id uuid not null references circles(id) on delete cascade,
  user_id   uuid not null references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);
create unique index circle_members_one_per_user on circle_members(user_id);  -- v1 rule

create table buildings (
  code     text primary key,               -- 'GHC'
  name     text not null,
  lat      double precision not null,
  lng      double precision not null,
  radius_m int  not null default 100
);

create table classes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  course_code   text not null,             -- '15-122'
  name          text,
  building_code text not null references buildings(code),
  days_of_week  smallint[] not null,       -- 0=Sun … 6=Sat
  start_time    time not null,             -- local America/New_York
  end_time      time not null,
  created_at    timestamptz not null default now()
);

create table class_occurrences (
  id               uuid primary key default gen_random_uuid(),
  class_id         uuid not null references classes(id) on delete cascade,
  user_id          uuid not null references profiles(id) on delete cascade,
  building_code    text not null references buildings(code),  -- copied from class; dev sets 'DEMO'
  date             date not null,
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  window_start     timestamptz not null,   -- starts_at - 10 min
  window_end       timestamptz not null,   -- starts_at + 15 min
  skip_deadline    timestamptz not null,   -- ends_at + 10 min
  status           occ_status not null default 'pending',
  reminder_sent_at timestamptz,            -- only used if remote push ever exists
  is_demo          boolean not null default false,
  created_at       timestamptz not null default now()
);
create unique index occ_one_per_class_day on class_occurrences(class_id, date) where not is_demo;
create index occ_pending_deadline on class_occurrences(skip_deadline) where status = 'pending';

create table checkins (
  id              uuid primary key default gen_random_uuid(),
  occurrence_id   uuid not null unique references class_occurrences(id) on delete cascade,
  user_id         uuid not null references profiles(id) on delete cascade,
  photo_path      text,                    -- storage path in bucket 'checkin-photos'; null once expired
  photo_back_path text,
  in_geofence     boolean not null default false,   -- never coordinates
  expires_at      timestamptz not null default now() + interval '24 hours',  -- 24h photo expiry hook
  created_at      timestamptz not null default now()
);

create table skips (
  id            uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null unique references class_occurrences(id) on delete cascade,
  user_id       uuid not null references profiles(id) on delete cascade,
  circle_id     uuid not null references circles(id) on delete cascade,
  excused       boolean not null default false,
  explanation   text,
  created_at    timestamptz not null default now()
);

create table forfeits (
  id             uuid primary key default gen_random_uuid(),
  circle_id      uuid not null references circles(id) on delete cascade,
  owed_by        uuid not null references profiles(id) on delete cascade,
  skip_id        uuid not null references skips(id) on delete cascade,
  description    text not null,            -- copied from circles.forfeit_text at creation
  status         forfeit_status not null default 'owed',
  marked_paid_by uuid references profiles(id),
  paid_at        timestamptz,
  local_date     date not null,            -- date of the skipped class, NY time
  created_at     timestamptz not null default now()
);
-- one forfeit per person per day (voided ones don't count against the cap)
create unique index forfeit_one_per_day on forfeits(circle_id, owed_by, local_date) where status <> 'voided';

create table feed_events (
  id            uuid primary key default gen_random_uuid(),
  circle_id     uuid not null references circles(id) on delete cascade,
  actor_id      uuid not null references profiles(id) on delete cascade,
  occurrence_id uuid references class_occurrences(id) on delete cascade,  -- lets dev_reset cascade
  type          feed_type not null,
  ref_id        uuid,                      -- checkins.id / skips.id / forfeits.id
  payload       jsonb not null default '{}',  -- denormalized display data (see contract below)
  created_at    timestamptz not null default now()
);
create index feed_by_circle on feed_events(circle_id, created_at desc);

create table reactions (
  id            uuid primary key default gen_random_uuid(),
  feed_event_id uuid not null references feed_events(id) on delete cascade,
  circle_id     uuid not null references circles(id) on delete cascade,  -- for the realtime filter
  user_id       uuid not null references profiles(id) on delete cascade,
  emoji         text not null,
  created_at    timestamptz not null default now(),
  unique (feed_event_id, user_id, emoji)
);

create table push_tokens (                 -- kept for a future dev build; unused in Expo Go
  token      text primary key,
  user_id    uuid not null references profiles(id) on delete cascade,
  platform   text,
  updated_at timestamptz not null default now()
);

alter publication supabase_realtime add table feed_events, reactions;
```

### Feed payload contract (freeze at H3; B and C both code against it)

| type | payload keys |
|---|---|
| `checkin` | display_name, avatar_url, course_code, photo_path, photo_back_path, in_geofence, personal_streak_after, circle_streak_after |
| `skip` | display_name, course_code, starts_at, personal_streak_before, circle_streak_before |
| `forfeit_owed` | display_name, description, forfeit_id |
| `explanation` | display_name, course_code, text |
| `excused` | display_name, course_code, pre_emptive (bool) |
| `forfeit_paid` | display_name, paid_by_name, description, forfeit_id |
| `member_joined` | display_name |

Rule: **clients never insert into `feed_events`**. Only SQL does (triggers + `detect_skips` + RPCs). This keeps one realtime channel authoritative.

### RLS helpers

```sql
create function my_circle_id() returns uuid
language sql stable security definer set search_path = public as $$
  select circle_id from circle_members where user_id = auth.uid() limit 1
$$;

create function same_circle(u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from circle_members a join circle_members b on a.circle_id = b.circle_id
    where a.user_id = auth.uid() and b.user_id = u)
$$;
```

### RLS policies (role `authenticated`; nothing for `anon`)

| table | select | insert | update | delete |
|---|---|---|---|---|
| profiles | any authenticated | self (`id = auth.uid()`) | self | — |
| circles | `id = my_circle_id()` | via `create_circle` RPC only | member | — |
| circle_members | `circle_id = my_circle_id()` | via `create_circle`/`join_circle` RPC only | — | — |
| buildings | any authenticated | — (seed + dev RPC) | — | — |
| classes | `same_circle(user_id)` | `user_id = auth.uid()` | self | self |
| class_occurrences | `same_circle(user_id)` | — (functions only) | — (functions only) | — |
| checkins | `same_circle(user_id)` | `user_id = auth.uid()` (trigger validates the rest) | — | — |
| skips | `same_circle(user_id)` | — (`detect_skips` only) | `user_id = auth.uid()` (explanation, excused) | — |
| forfeits | `circle_id = my_circle_id()` | — | — (`mark_forfeit_paid` RPC enforces payer ≠ owed_by) | — |
| feed_events | `circle_id = my_circle_id()` | — (SQL only) | — | — |
| reactions | `circle_id = my_circle_id()` | `user_id = auth.uid() and circle_id = my_circle_id()` | — | self |
| push_tokens | self | self | self | self |

Storage bucket `checkin-photos` (private): insert where `(storage.foldername(name))[1] = auth.uid()::text`; select for any authenticated user. Paths: `{user_id}/{occurrence_id}.jpg` and `…-back.jpg`. Seed photos under `seed/…`, uploaded with the service key.

All trigger functions and RPCs are `security definer set search_path = public`; otherwise a client-triggered trigger runs as the user and its `feed_events` insert fails under RLS, taking the check-in with it. Every helper and RPC needs `grant execute … to authenticated`. The `circle_members` policy goes through `my_circle_id()` (security definer) precisely so it never queries `circle_members` under its own policy, which would recurse. Escape hatch if Realtime + RLS still fights at H6: disable RLS on `feed_events` only and rely on the channel filter; it is the least sensitive table (denormalized display text, no coordinates).

Forfeit cards render their status (owed / paid / voided) from the live `forfeits` row matched by `payload.forfeit_id`, never from the event payload, so an excuse or payment updates the original card in place.

### 24h photo expiry

Hook is `checkins.expires_at`. Client hides any photo where `expires_at < now()` (one `if`). Optional cron, one line: `cron.schedule('expire-photos','0 * * * *', $$update checkins set photo_path = null, photo_back_path = null where expires_at < now() and photo_path is not null$$)`. Deleting the underlying storage objects is a post-hackathon edge function; the signed URLs expire within the hour anyway. Seed photos get `expires_at = now() + 7 days` so history survives the demo.

## 3. Skip detection

**Recommendation: one idempotent SQL function, `detect_skips()`, invoked from three places.** No edge function.

1. `pg_cron` every minute (`cron.schedule('detect-skips','* * * * *', $$select detect_skips()$$)`).
2. The client on app open / foreground (`supabase.rpc('detect_skips')`, cheap and idempotent).
3. The dev "End window now" button, which first pulls the deadlines to `now()` and then calls it, so the demo never waits for a cron tick.

Why not an edge function on cron: adds a deploy step, secrets, and a second runtime for zero benefit; pg_cron calling plpgsql is the fewest moving parts. Why not client-only: phones asleep at 10:40 would delay skips indefinitely, and N clients racing is only safe because the function is idempotent anyway. Why not a DB trigger: nothing fires when time passes.

Idempotency: only rows with `status = 'pending' and skip_deadline <= now()` are touched, locked with `for update skip locked`, and the status flips inside the same transaction, so concurrent callers cannot double-post. The check-in trigger locks the occurrence and requires `pending`, so a check-in racing the cron produces either a check-in or a skip, never both.

Streak snapshots are memoized per user and per circle for the whole run and taken before any status flips, so two members skipped in the same batch both show "8 → 0" rather than the second showing "0 → 0".

```sql
create or replace function detect_skips() returns int
language plpgsql security definer set search_path = public as $$
declare
  o record; cid uuid; s_id uuid; f_id uuid; n int := 0;
  nm text; ftext text; p_before int; c_before int;
  p_memo jsonb := '{}'; c_memo jsonb := '{}';   -- streaks "before", frozen per user / circle for this run
begin
  for o in
    select occ.id, occ.user_id, occ.starts_at, cl.course_code, cm.circle_id
    from class_occurrences occ
    join classes cl on cl.id = occ.class_id
    left join circle_members cm on cm.user_id = occ.user_id
    where occ.status = 'pending' and occ.skip_deadline <= now()
    for update of occ skip locked
  loop
    cid := o.circle_id;
    if cid is null then
      update class_occurrences set status = 'skipped' where id = o.id;  -- no circle: nothing to post
      continue;
    end if;

    if not p_memo ? o.user_id::text then
      p_memo := p_memo || jsonb_build_object(o.user_id::text, personal_streak(o.user_id));
    end if;
    if not c_memo ? cid::text then
      c_memo := c_memo || jsonb_build_object(cid::text, circle_streak(cid));
    end if;
    p_before := (p_memo ->> o.user_id::text)::int;
    c_before := (c_memo ->> cid::text)::int;
    select display_name into nm from profiles where id = o.user_id;
    select forfeit_text into ftext from circles where id = cid;

    update class_occurrences set status = 'skipped' where id = o.id;

    insert into skips (occurrence_id, user_id, circle_id)
      values (o.id, o.user_id, cid) returning id into s_id;

    insert into forfeits (circle_id, owed_by, skip_id, description, local_date)
      values (cid, o.user_id, s_id, ftext, (o.starts_at at time zone 'America/New_York')::date)
      on conflict (circle_id, owed_by, local_date) where status <> 'voided' do nothing
      returning id into f_id;                      -- null when the daily cap already hit

    insert into feed_events (circle_id, actor_id, occurrence_id, type, ref_id, payload)
      values (cid, o.user_id, o.id, 'skip', s_id, jsonb_build_object(
        'display_name', nm, 'course_code', o.course_code, 'starts_at', o.starts_at,
        'personal_streak_before', p_before, 'circle_streak_before', c_before));

    if f_id is not null then
      insert into feed_events (circle_id, actor_id, occurrence_id, type, ref_id, payload)
        values (cid, o.user_id, o.id, 'forfeit_owed', f_id, jsonb_build_object(
          'display_name', nm, 'description', ftext, 'forfeit_id', f_id));
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;
grant execute on function detect_skips() to authenticated;
```

The other side of the race, the check-in trigger. It is `after insert` so `new.id` exists for the event, and it computes the "after" streaks once the status has flipped:

```sql
create or replace function on_checkin_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare o class_occurrences; cid uuid; cc text; nm text;
begin
  select * into o from class_occurrences where id = new.occurrence_id for update;
  if o.user_id <> new.user_id then raise exception 'not your class'; end if;
  if o.status <> 'pending'      then raise exception 'class is already %', o.status; end if;
  if now() < o.window_start or now() > o.window_end then raise exception 'outside check-in window'; end if;

  update class_occurrences set status = 'checked_in' where id = o.id;
  select circle_id into cid from circle_members where user_id = new.user_id limit 1;
  select course_code into cc from classes where id = o.class_id;
  select display_name into nm from profiles where id = new.user_id;
  if cid is not null then
    insert into feed_events (circle_id, actor_id, occurrence_id, type, ref_id, payload)
      values (cid, new.user_id, o.id, 'checkin', new.id, jsonb_build_object(
        'display_name', nm, 'course_code', cc, 'photo_path', new.photo_path,
        'photo_back_path', new.photo_back_path, 'in_geofence', new.in_geofence,
        'personal_streak_after', personal_streak(new.user_id),
        'circle_streak_after', circle_streak(cid)));
  end if;
  return new;
end $$;
create trigger checkins_after_insert after insert on checkins
  for each row execute function on_checkin_insert();
```

The client shows the `raise exception` text verbatim in the failure state, so the messages are user-facing copy.

There is **no insert trigger on `skips`**: `detect_skips` writes the `skip` and `forfeit_owed` events itself (it has the streak snapshots), and the pre-emptive `excuse_occurrence` RPC writes its own `excused` event. The only trigger on `skips` is `after update`, for explanation and after-the-fact excuse. This is what prevents duplicate skip cards.

The skipper's phone opens the explain-yourself modal when its feed subscription receives a `skip` event with `actor_id = me`, **and** whenever the periodic state fetch (§6) returns a skip of mine with `explanation is null and excused = false`. Realtime accelerates the modal; it is not required for it. No push involved. A local notification scheduled at `skip_deadline` ("You missed 15-122. Explain yourself.") covers the backgrounded case and is cancelled on check-in (§7).

Occurrence generation, which skip detection depends on:

```sql
create or replace function ensure_occurrences(p_from date, p_days int default 1) returns void
language sql security definer set search_path = public as $$
  insert into class_occurrences
    (class_id, user_id, building_code, date, starts_at, ends_at, window_start, window_end, skip_deadline)
  select c.id, c.user_id, c.building_code, d::date,
         (d + c.start_time) at time zone 'America/New_York',
         (d + c.end_time)   at time zone 'America/New_York',
         (d + c.start_time) at time zone 'America/New_York' - interval '10 min',
         (d + c.start_time) at time zone 'America/New_York' + interval '15 min',
         (d + c.end_time)   at time zone 'America/New_York' + interval '10 min'
  from classes c
  cross join generate_series(p_from::timestamp, (p_from + p_days - 1)::timestamp, interval '1 day') d
  where extract(dow from d)::smallint = any (c.days_of_week)
    and (d + c.end_time) at time zone 'America/New_York' + interval '10 min' > now()  -- never create an already-missed class
  on conflict (class_id, date) where not is_demo do nothing;
$$;
```

The `> now()` guard matters: without it, a teammate adding a 9:30 class at 3 pm on demo day gets a pending occurrence whose deadline has passed, and the next `detect_skips` posts a skip and a forfeit and kills the seeded streak. Past classes on the day of entry simply do not exist; the seed inserts today's past occurrences directly.

Called by: pg_cron daily at 04:05 UTC (`ensure_occurrences(current_date, 2)`), the client on app open (`ensure_occurrences(today, 1)`), and an `after insert or update on classes` trigger for the next 7 days for that class (on update, first delete that class's future `pending` occurrences). If pg_cron setup eats more than 15 minutes, drop it: the app-open call and the dev button cover the demo, and cron is only needed for real-world use.

## 4. Streak computation

Computed on read. No counters. Reasons: no drift, after-the-fact excuses and dev resets "just work", and the seed script only has to write occurrences. Data volume is trivial (4 users × ~5 classes × 14 days).

Definition:
- Group a user's (or a circle's members') occurrences by local date.
- A day is **broken** if any occurrence has `status = 'skipped'` (excused skips have status `excused`, so they never break).
- A day is **complete** if every occurrence is `checked_in` or `excused`.
- A day with pending occurrences and no skip is **undecided** and ignored (today, mid-morning).
- Streak = number of consecutive complete days going backwards from the most recent decided day, stopping at the first broken day.

```sql
create or replace function personal_streak(p_user uuid) returns int
language sql stable security definer set search_path = public as $$
  with days as (
    select (starts_at at time zone 'America/New_York')::date as d,
           bool_or(status = 'skipped') as broken,
           bool_and(status in ('checked_in','excused')) as complete
    from class_occurrences where user_id = p_user
    group by 1
  ), decided as (
    select broken, row_number() over (order by d desc) as rn
    from days where broken or complete
  )
  select count(*)::int from decided
  where rn < coalesce((select min(rn) from decided where broken), 2147483647);
$$;

create or replace function circle_streak(p_circle uuid) returns int
language sql stable security definer set search_path = public as $$
  with days as (
    select (o.starts_at at time zone 'America/New_York')::date as d,
           bool_or(o.status = 'skipped') as broken,
           bool_and(o.status in ('checked_in','excused')) as complete
    from class_occurrences o
    join circle_members m on m.user_id = o.user_id and m.circle_id = p_circle
    where o.starts_at >= m.joined_at            -- ignore history from before someone joined
    group by 1
  ), decided as (
    select broken, row_number() over (order by d desc) as rn
    from days where broken or complete
  )
  select count(*)::int from decided
  where rn < coalesce((select min(rn) from decided where broken), 2147483647);
$$;
```

Edge cases, by construction: a date with zero occurrences (weekend, no-class day) never appears in `days`, so it neither breaks nor extends anything. A past `pending` occurrence that no one has detected yet is "undecided" and gets counted through until `detect_skips` runs, which the app-open call makes a matter of seconds. A user or circle with no decided days has streak 0.

Where it runs: both functions are called inside `get_circle_state()` (§6), so Home and Feed get streaks with everything else in one round trip, refreshed on every incoming feed event and on the periodic fetch. `detect_skips` also snapshots the "before" values into the skip event payload so the feed card can render "8 → 0" without a second query, and the check-in trigger snapshots "after" values for the "9-day streak" flash on the success screen.

Excused handling: `excuse_occurrence(occurrence_id)` RPC (pre-emptive: occurrence `pending → excused`, insert `skips` row with `excused = true`, insert `excused` feed event) and `skips` update with `excused = true` (after the fact: trigger sets occurrence `skipped → excused`, voids the unpaid forfeit, posts `excused` event). Because streaks are computed on read, both paths restore the streak with no extra code.

## 5. Screens

Expo Router file names in parentheses. Owner in brackets.

**Onboarding / auth** (`app/(auth)/sign-in.tsx`, `sign-up.tsx`) [D screens, C session] — Email, password, display name on sign-up. Supabase email confirmation is off, so sign-up logs in immediately. A `SessionProvider` (React context) wraps the app, restores the session from AsyncStorage, and routes: no session → auth; session but no circle → create/join circle; session but no classes → schedule entry; else → tabs. Realtime subscriptions must only be created once `session` is non-null.

**Schedule entry** (`app/schedule/index.tsx`, `edit.tsx`) [D] — List of the user's classes with add/edit/delete. Form: course code, name (optional), building picker (from `buildings`), day-of-week chips, start and end time pickers. Saving inserts/updates `classes`; the DB trigger generates the next 7 days of occurrences. Reachable from Home ("Edit schedule") and as onboarding step 2. Shows a one-line reminder of the rule: check-in window is 10 min before to 15 min after start.

**Create / join circle** (`app/circle/new.tsx`, `join.tsx`) [B] — Two tabs. Create: circle name, forfeit picker (4 presets as large tappable cards + "Custom…" text field), calls `create_circle(name, forfeit_text)` which returns the invite code, shown big with a copy button. Join: 6-char code input, calls `join_circle(code)`; on success shows the circle's members and forfeit ("This circle's forfeit: buys the circle boba") and posts a `member_joined` event.

**Home** (`app/(tabs)/index.tsx`) [D] — Header: circle name, circle streak (🔥 N), personal streak. Body: today's occurrences sorted by time, each a card with course, building, time, and status pill: "Opens in 2:14", "Check in — closes in 11:30" (primary button, goes to camera), "Checked in ✓", "Skipped", "Excused". For an open window, the card shows "3 of 4 in your circle are there" computed from circle members' occurrences with the same `course_code` and `starts_at`. Pending cards have a small "Can't make it (sick / emergency)" link that calls `excuse_occurrence`. Pull to refresh; calls `ensure_occurrences` + `detect_skips` on mount and on foreground, then reschedules local notifications.

**Check-in camera** (`app/checkin/[occurrenceId].tsx`) [A] — Full-screen `CameraView`, front camera default, flip button. On mount: requests camera and foreground location permission, starts a GPS fix in parallel with the camera warm-up, shows a countdown "window closes in 4:12". Capture → preview with Retake / Use photo. "Use photo": geofence check (§8) → resize to 1080 px wide, JPEG 0.6 with `expo-image-manipulator` (~150 KB; a raw 12 MP shot is 2–4 MB and dies on bad wifi) → upload to `checkin-photos/{uid}/{occurrenceId}.jpg` as an `ArrayBuffer` from `fetch(uri).then(r => r.arrayBuffer())` with explicit `contentType: 'image/jpeg'` (the `.blob()` route uploads 0-byte files in React Native; fallback is `expo-file-system` base64 + `base64-arraybuffer`) → insert `checkins` row (trigger validates window, flips occurrence status, writes the feed event). If uploads still take more than 2 s at H6, flip the order: insert the row first with the predetermined path so the card lands instantly, and let the image fill in. Success state: big check, "You're in. 9-day streak.", auto-return to Home in 2 s. Failure states (each one screen with a retry button): outside window, outside geofence ("You're 240 m from GHC"), location denied, upload failed. Dual capture (flag `DUAL_CAPTURE`): after the front shot, auto-flip and take the back shot 1 s later, store as `photo_back_path`.

**Circle feed** (`app/(tabs)/feed.tsx`) [B] — Reverse-chronological `FlatList` of `feed_events` for `my_circle_id()`, page size 50, grouped by day. One card component per `type`: check-in (photo, name, course, time, streak chip), skip (red, "Alex skipped 15-122 at 9:30 · circle streak 8 → 0"), forfeit owed (amber, "Alex owes the circle boba", "Mark paid" button hidden for the owner), explanation (quote bubble under the skip), excused (grey), forfeit paid (green, "Alex paid up · confirmed by Sam"), member joined. Emoji reaction row on each card. Green "live" dot in the header while the realtime channel is `SUBSCRIBED`; polling fallback otherwise (§6). Photos load via a signed-URL cache keyed by path.

**Forfeit detail** (`app/forfeit/[id].tsx`) [B] — Who owes what, since when, the skip that caused it, the explanation if any, status. "Mark paid" button (calls `mark_forfeit_paid(id)`, disabled for the owner with the copy "Only your circle can clear this"). Paid state shows who confirmed and when. Also lists the circle's open forfeits at the bottom ("2 owed").

**Explain-yourself modal** (`app/explain/[skipId].tsx`, presented as a modal) [B] — Triggered automatically on the skipper's phone when a `skip` feed event with `actor_id = me` arrives, from tapping the "missed" local notification, and from the "Explain" button on the skip card (only visible to the skipper). Copy: "You skipped 15-122. Your circle is waiting." One text input (140 chars) + "Post" → updates `skips.explanation` (trigger posts the `explanation` event). Secondary button "It was sick / emergency" → updates `skips.excused = true` (trigger voids the forfeit, posts `excused`). Dismissable; the skip card keeps the "Explain" button until explained.

**Dev / demo controls** (`app/dev.tsx`) [D] — Reachable by 5 taps on the profile avatar when `EXPO_PUBLIC_DEV_PANEL=1`. Buttons: "Start 15-122 now (window 3 min)" (`dev_start_class_now`), "End window now" (`dev_end_window_now`), "Reset demo state" (`dev_reset_demo`), "Set demo building to my location" (`dev_set_demo_building(lat, lng)`), "Replay: check in as P2 / P3" (`dev_replay_checkin(user)`), "Replay: post Alex's explanation", "Replay: pay Alex's forfeit", "Show my coordinates + accuracy", "Force skip detection" (`detect_skips`), and a runtime toggle "Bypass geofence" (overrides `REQUIRE_GEOFENCE` in memory, still stores the real boolean). Every button shows the RPC result inline. Also shows realtime channel status, last state-fetch time, and the resolved circle id.

Signatures (all `security definer`, all scoped to the caller's circle, all deleted before any real release):

```
dev_start_class_now(p_course text, p_window_min int default 3, p_skip_after_min int default 3) returns int
  -- runs dev_reset_demo() first, then inserts an is_demo occurrence for every circle member
  -- who has a class with course_code = p_course: date = today, starts_at = now(),
  -- window_start = now() - 1 min, window_end = now() + p_window_min,
  -- ends_at = skip_deadline = now() + p_skip_after_min, building_code = 'DEMO' if that row exists
dev_end_window_now() returns int
  -- update is_demo pending occurrences in my circle: window_end = skip_deadline = now(); then detect_skips()
dev_reset_demo() returns void
  -- delete is_demo occurrences in my circle (cascade removes checkins, skips, forfeits, feed_events)
dev_set_demo_building(p_lat float8, p_lng float8) returns void
  -- upsert buildings('DEMO', 'Demo room', lat, lng, 300)   -- generous: indoor GPS drifts 100 m+
dev_replay_checkin(p_user uuid) returns void
  -- insert a checkins row for that member's pending demo occurrence using a seed photo path
dev_replay_explanation(p_text text) / dev_replay_pay_forfeit() returns void
```

## 6. Realtime plan

Two mechanisms, both always on. Subscriptions make the demo feel instant; a slow poll makes it survive.

**State fetch.** One RPC, `get_circle_state()` (security definer, scoped to `my_circle_id()`), returns jsonb: `{ circle, members, circle_streak, personal_streak, today: [occurrences of every member for today with status], open_forfeits, my_unexplained_skips, feed: last 50 feed_events }`. A `CircleStateProvider` (React context) calls it on mount, on `AppState` → active, on pull-to-refresh, on every realtime event (debounced 300 ms), and on a 5 s interval while foregrounded. Home, Feed, Forfeit detail, and the explain modal all read from this one context. The interval is the safety net: iOS suspends the websocket when a phone locks, and after resume supabase-js can report `SUBSCRIBED` for up to a heartbeat while receiving nothing, so "poll only when not subscribed" has a blind spot exactly when a teammate unlocks their phone mid-demo.

**Subscription.** One channel per circle, two listeners, `postgres_changes` INSERT only:

```ts
useEffect(() => {
  if (!session || !circleId) return;                 // never subscribe before auth is restored
  const ch = supabase.channel(`feed:${circleId}`)
    .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'feed_events', filter: `circle_id=eq.${circleId}` },
        (p) => onFeedEvent(p.new))
    .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reactions', filter: `circle_id=eq.${circleId}` },
        (p) => onReaction(p.new))
    .subscribe((status) => setLive(status === 'SUBSCRIBED'));
  return () => { supabase.removeChannel(ch); };
}, [session?.access_token, circleId]);
```

`onFeedEvent`: prepend the row to the list (dedupe by id), request a signed URL if `payload.photo_path`, then trigger the debounced state fetch. If `row.type === 'skip' && row.actor_id === me`, open the explain modal (the state fetch's `my_unexplained_skips` does the same when realtime is late).

Session upkeep, in `SessionProvider` [C]: on `AppState` active call `supabase.auth.startAutoRefresh()` and re-run the state fetch; on background call `stopAutoRefresh()`. Without this an access token expires mid-demo and the channel dies silently. Re-create the channel when `session.access_token` changes (the effect dependency above does this).

How phone A's check-in reaches phone B: A uploads the photo, then inserts a `checkins` row → `after insert` trigger flips the occurrence to `checked_in` and inserts a `feed_events` row in the same transaction → on commit, Realtime reads the WAL, evaluates B's RLS (`circle_id = my_circle_id()`) and delivers the row to B's channel → B prepends the card and calls `createSignedUrl(photo_path)` → image renders. Expected latency under 1 s on a hotspot.

Setup checklist (C, by H6): tables in the `supabase_realtime` publication; RLS select policies on both tables; channel created only after the session exists (supabase-js forwards the JWT to Realtime on auth events, but a channel joined before restore stays anonymous and silently receives nothing); B verifies with two phones at H1 on a throwaway table.

Fallback: when `live` is false, the 5 s interval tightens to 2 s. Signed URLs are cached in memory by path for the hour they are valid, so polling does not re-sign. The demo therefore degrades to 2 s latency, not to failure.

## 7. Notifications plan

**Primary: client-scheduled local notifications** (works in Expo Go). Module `lib/notifications.ts` [C], one function:

```ts
export async function rescheduleLocalNotifications(todays: Occurrence[]) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const o of todays.filter(o => o.status === 'pending')) {
    const remindAt = new Date(+new Date(o.starts_at) - 5 * 60_000);
    await Notifications.scheduleNotificationAsync({
      content: { title: `${o.course_code} starts in 5 min`,
                 body: 'Open Present and check in. Your circle is watching.',
                 data: { route: `/checkin/${o.id}` } },
      trigger: remindAt > new Date() ? { type: 'date', date: remindAt } : null,  // null = fire now (demo)
    });
    await Notifications.scheduleNotificationAsync({
      content: { title: `You missed ${o.course_code}`, body: 'Explain yourself to your circle.',
                 data: { route: `/explain/occ/${o.id}` } },
      trigger: { type: 'date', date: new Date(o.skip_deadline) },
    });
  }
}
```

Called after `ensure_occurrences` on app open, after every check-in, excuse, or schedule edit, and on foreground. Cancel-all-then-reschedule avoids tracking notification ids. `setNotificationHandler` returns `shouldShowBanner: true, shouldShowList: true` so banners appear while the app is foregrounded (that is what the projector sees). Tapping a notification routes via `data.route`. Permission is requested on onboarding step 3 with a one-line explanation.

Spec deviation: "3 of your circle are already there" cannot be in a locally scheduled body. It lives on the Home card and the camera screen instead. Say this to judges as a design choice if asked.

**Stretch, only if someone brings an EAS development build (not Expo Go):** server push. `pg_cron` every minute runs `send_class_reminders()`: selects occurrences with `starts_at` in `[now()+4min, now()+6min)` and `reminder_sent_at is null`, counts checked-in circle-mates for the same course and `starts_at`, and calls Expo's push API with `pg_net` (`net.http_post('https://exp.host/--/api/v2/push/send', …)`) using `push_tokens`, then sets `reminder_sent_at`. Skip the whole thing unless a dev build already works on every phone by H6.

**Fallback if local scheduling misbehaves** (permission denied, iOS Focus mode): Home shows an in-app "15-122 starts in 5 min" banner driven by a 30 s timer, and the camera screen countdown. First item on the cut list anyway.

## 8. Geofence

Storage: `buildings(code, name, lat, lng, radius_m)`. Occurrences carry `building_code`. Check-ins store only `in_geofence boolean`. Coordinates never leave the phone.

Client check, in `lib/geofence.ts` [A]:

```ts
const R = 6_371_000;
export function metersBetween(a: {lat:number;lng:number}, b: {lat:number;lng:number}) {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export async function checkGeofence(b: Building) {
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  const d = metersBetween({ lat: pos.coords.latitude, lng: pos.coords.longitude }, b);
  const slack = Math.min(pos.coords.accuracy ?? 0, 50);   // indoor GPS is 30–65 m on iPhone
  return { inside: d <= b.radius_m + slack, distance: Math.round(d) };
}
```

Rules: start the GPS fix when the camera screen mounts so it is ready by capture time; hard timeout 8 s, then one retry with `Accuracy.Balanced`; if location is denied or times out, block with the "location needed" failure state. `REQUIRE_GEOFENCE` flag (default true, overridable from the dev panel) lets the team drop the gate per the cut list without touching the flow: when false, still compute and store `in_geofence`, just don't block. The dev panel's "Set demo building" writes the `DEMO` row at the presenter's position with a 300 m radius, and `dev_start_class_now` points demo occurrences at it, so the judging room passes the check even with a 100 m indoor fix. If the presenter still fails at rehearsal, the bypass toggle is the answer, not a code change.

Starter buildings (approximate centroids, ±50 m, D verifies by standing inside each with "Show my coordinates" or against Google Maps):

| code | name | lat | lng | radius_m |
|---|---|---|---|---|
| GHC | Gates & Hillman Centers | 40.4436 | -79.9446 | 110 |
| WEH | Wean Hall | 40.4427 | -79.9457 | 100 |
| DH | Doherty Hall | 40.4423 | -79.9446 | 100 |
| BH | Baker Hall | 40.4415 | -79.9444 | 100 |
| PH | Porter Hall | 40.4416 | -79.9455 | 100 |
| HH | Hamerschlag Hall | 40.4424 | -79.9466 | 90 |
| SH | Scaife Hall | 40.4422 | -79.9472 | 90 |
| HL | Hunt Library | 40.4409 | -79.9437 | 90 |
| CUC | Cohon University Center | 40.4431 | -79.9420 | 110 |
| TEP | Tepper Quad | 40.4450 | -79.9456 | 110 |
| POS | Posner Hall | 40.4411 | -79.9422 | 80 |
| MM | Margaret Morrison Carnegie Hall | 40.4404 | -79.9426 | 90 |
| NSH | Newell-Simon Hall | 40.4435 | -79.9455 | 90 |
| MI | Mellon Institute | 40.4457 | -79.9512 | 100 |
| DEMO | Demo room (set from dev panel) | — | — | 300 |

## 9. Seed script spec

`scripts/seed.ts`, run with `npm run seed` (`tsx`). Uses supabase-js with the service-role key for auth users and storage, and `pg` with the direct `DATABASE_URL` for row inserts (so it can `set session_replication_role = replica` and insert history with explicit timestamps without the check-in trigger rejecting closed windows). Fully idempotent: it wipes and rebuilds.

Inputs: `scripts/seed/schedules.json` (collected at H0: per member, course_code, name, building_code, days, start, end), `scripts/seed/photos/` (20 selfies the team takes on campus during H1–H6, ~5 per person, plus 4 avatars).

Steps:
1. Wipe: delete the 4 seed users via `auth.admin.deleteUser` (cascades through `profiles` to everything), delete `buildings`, delete `seed/` objects in the bucket.
2. Upsert the 15 buildings from §8.
3. Create 4 users: `<first>@present.demo` / `present-demo-2026`, `display_name` from the JSON, avatar uploaded to `seed/avatars/<first>.jpg`.
4. Create the circle: team name, `forfeit_text = 'buys the circle boba'`, `invite_code = 'BOBA26'`, all 4 members with `joined_at = now() - 21 days`.
5. Insert each member's classes. Every member must have the demo course (e.g. 15-122 MWF 09:30–10:20 GHC), real or invented, so `dev_start_class_now('15-122')` creates 4 occurrences.
6. History: 10 class-days (the two prior Mon–Fri weeks). For every class on each day: occurrence with real `starts_at`, status `checked_in`, a `checkins` row (`photo_path = seed/photos/<first>-<n>.jpg` cycling, `in_geofence = true`, `expires_at = now() + 7 days`, `created_at = starts_at + random(0…8 min)`), and a `checkin` feed event with the same `created_at` and a payload matching the contract (streak values computed by the script).
7. One past skip: on day −9, member Sam (not the demo skipper) misses one class. Occurrence `skipped`, `skips` row with `explanation = 'overslept, my bad'` (`created_at` = deadline + 12 min), forfeit `paid` by member 3 on day −8 at 18:00. Feed events: `skip` (with `circle_streak_before = 1`, since seed starts at day −10), `forfeit_owed`, `explanation`, `forfeit_paid`. Reactions on the skip (💀 ×2) and on the paid event (🧋 ×3).
8. Today: occurrences whose `skip_deadline` is already past are `checked_in` with photos; future ones are `pending`; `ensure_occurrences(today, 2)` fills anything missing.
9. Print the 4 logins and the resulting streaks.

Resulting state at demo time: circle streak 8, personal streaks 8 (Sam) and 10 (others). The skip moment renders "8 → 0". If the hackathon falls such that "today" is a weekend, history is still 10 weekdays back, and today has no natural occurrences, which is fine: the demo occurrence is the only one.

Also seeds nothing into `push_tokens`. `dev_reset_demo` (not the seed) is what runs between rehearsals; the seed runs once at H9, once at H18, and once 30 min before judging.

## 10. Hour-by-hour build order

Repo layout created at H0 by C so four people never touch the same file: `app/(auth)/`, `app/(tabs)/index.tsx` (Home), `app/(tabs)/feed.tsx`, `app/checkin/`, `app/circle/`, `app/forfeit/`, `app/explain/`, `app/schedule/`, `app/dev.tsx`, `lib/supabase.ts`, `lib/session.tsx`, `lib/types.ts` (generated), `lib/api/{checkin,circle,schedule,dev}.ts` (one per owner), `lib/notifications.ts`, `lib/geofence.ts`, `components/feed/`, `supabase/migrations/`, `scripts/seed.ts`.

| Hour | A — Check-in | B — Circles/feed/forfeits | C — Backend/auth/notifs/skips | D — Schedule/seed/pitch |
|---|---|---|---|---|
| H0–H1 | On a real iPhone in Expo Go: camera permission, `takePictureAsync`, location permission, `getCurrentPositionAsync`, resize with `expo-image-manipulator`, upload to a test bucket via `fetch(uri).then(r => r.arrayBuffer())` and confirm the object is not 0 bytes. Report pass/fail by H1. | Realtime hello world: subscribe to a throwaway table from two phones, insert from the SQL editor, confirm both receive it with RLS on and a filter set. | Create Supabase project, enable pg_cron, create bucket, invite team. `create-expo-app` (SDK 57), install `expo-camera expo-location expo-notifications expo-image-manipulator @supabase/supabase-js @react-native-async-storage/async-storage expo-image`, commit the layout above + `.env.example`. | Collect all 4 schedules into `schedules.json`, confirm the shared demo course, list buildings, confirm judging room and mirroring hardware (USB cable + QuickTime, or AirPlay). |
| H1–H3 | Camera screen UI: front default, flip, capture, preview, retake. Countdown component. | Create/join circle screens with forfeit picker (mock data). Feed list with one card component per event type on mock events. | Migration 0001: enums, tables, indexes, RLS, helpers, storage policies, `profiles` trigger. Apply, `supabase gen types` → `lib/types.ts`. **Schema draft + payload contract shared by H3.** | Onboarding screens (sign-in/up UI), schedule entry screen + form, building picker, tab bar/navigation skeleton, `lib/api/schedule.ts`. |
| H3–H6 | Geofence module, window validation, resize + upload, `checkins` insert, success/failure states. | `CircleStateProvider` (state fetch + 5 s interval + AppState), feed reads real `feed_events`, realtime subscription, signed-URL cache, create/join wired to RPCs. | `ensure_occurrences`, `detect_skips`, streak functions, `get_circle_state`, check-in trigger, `create_circle`/`join_circle`/`mark_forfeit_paid`/`excuse_occurrence` RPCs, `lib/supabase.ts` + `SessionProvider` (with auto-refresh on AppState), pg_cron jobs. Dev RPC stubs. | Schedule CRUD wired; Home v1 (today's occurrences + status pills, from the state context); dev panel screen with buttons wired to stub RPCs; buildings inserted. |
| **H6 checkpoint** | Two phones, two seed-ish accounts in one circle: A checks in → row appears → B's feed shows the photo within 2 s. Schema frozen: additive migrations only, announced in chat. |
| H6–H9 | Countdown + copy for every failure state, permission-denied flows, compression tuning (~300 KB per photo), dual-capture spike (timebox 1 h). | Skip card, forfeit-owed card with "Mark paid" (hidden for owner), explain-yourself modal auto-open on own skip event, explanation card, reactions. | Skip detection end to end with `dev_end_window_now`; forfeit cap tested (two skips, one forfeit); streaks checked against hand-computed numbers; `detect_skips` + `ensure_occurrences` called on app open. | Seed script v1 (users, circle, classes, buildings, 10 days history, past skip + paid forfeit). Home shows streaks and "N of 4 there". |
| H9–H12 | Dual capture in or cut. Upload retry. Success screen shows streak. Check-in reachable from a notification tap. | Forfeit detail screen. Feed polish (avatars, relative times, day headers). Polling fallback + live dot. | `lib/notifications.ts` (local schedule/cancel, handler, tap routing). RLS audit with a fifth account in a second circle: sees nothing. | Dev panel complete (start/end/reset/set building/replay ×3/show coords). Seed photos taken and wired. Seed run on the shared project. |
| **H12 checkpoint** | Full loop on 4 phones: reset → start now → 3 check-ins → end window → skip + forfeit → explain → paid. **Record this on video.** D owns the pitch from here. |
| H12–H15 | Fix everything the run-through surfaced. Haptics on success. Handle app backgrounded mid-upload. | Streak-death animation on the skip card and Home counter (the money shot). Excused card. Empty states. | Excused skips wired both paths. Photo-expiry cron. `supabase db dump` backup. Verify cron generated tomorrow's occurrences. | Slides (≤6), pitch script v1, second seed run to prove idempotency, screenshots for slides. |
| H15–H18 | Bug bash: A and B swap phones and break each other's screens. C fixes RLS/perf issues. D rehearses with the dev panel. Decide cuts per §6. |
| **H18 checkpoint** | Full run-through on the projector setup with seeded data. Apply cut list if anything fails. Re-record the video. |
| H18–H22 | Bug fixes only. Try/catch around every camera/location/upload call; never a blank screen. | Same. Copy polish on cards. | Fresh-project drill: `supabase db reset` + seed on a second project must work (insurance). | Rehearse pitch ×2 with a timer. Phones: auto-lock never, brightness max, notifications allowed, Focus off. |
| **H22 freeze** | No code changes. Rehearse twice more. Sleep in shifts. T−30 min: run seed, all phones on the hotspot, signed in, live dot green. |

What each person needs from the others, by when:
- **A needs** from C by H3: `lib/supabase.ts`, session hook, `checkins`/`class_occurrences` types; by H6: storage bucket + policies, check-in trigger live. From D by H6: `buildings` rows and `building_code` on occurrences. From D by H9: seed accounts to test with.
- **B needs** from C by H3: the payload contract and `feed_type` enum; by H6: publication + RLS live, `create_circle`/`join_circle`; by H9: `mark_forfeit_paid`, `skips` update policy, `excuse_occurrence`. From D by H9: seeded history so cards render against real data.
- **C needs** from D by H1: schedules and the demo course (to shape the seed and dev RPCs); from A by H6: the photo path convention; from B by H3: the list of payload fields each card wants (input to the contract).
- **D needs** from C by H3: `classes`/`buildings` schema and dev RPC names; by H9: dev RPC bodies; from A by H12: working check-in so `dev_replay_checkin` can mimic it; from B by H15: final feed look for slide screenshots.

## 11. Demo runbook

Phones: **P1** presenter (mirrored to projector, checks in), **P2** and **P3** teammates (check in), **P4** "Alex" (skips). One teammate holds a boba.

Pre-flight (T−30 min):
1. Laptop and all 4 phones on the team hotspot.
2. `npm run seed` from the laptop. Confirm it prints streak 8.
3. Each phone: force-quit and reopen Present in Expo Go, confirm signed in as the right person, Feed shows two weeks of history, live dot green.
4. P1 mirrored (USB → QuickTime → New Movie Recording → camera source P1; tested at H18). Confirm the projector shows the feed.
5. P1 dev panel: "Set demo building to my location", then "Reset demo state". Home shows circle streak 8.
6. Phones: auto-lock off, brightness max, Focus off, volume up.

Script (target 100 s):

| t | Who | Press | Projector shows |
|---|---|---|---|
| 0:00 | P1 | Feed tab | Two weeks of check-ins, 🔥 8-day circle streak. "Strava for showing up to class. Photo check-in, small circle, shared streak." |
| 0:10 | P1 | Avatar ×5 → dev → "Start 15-122 now" | Home: 15-122 card "Check in — closes in 2:59". Local banner "15-122 starts in 5 min" on every phone. |
| 0:20 | P1, P2, P3 | Home → card → snap → Use photo | P1's success screen "You're in. 11-day streak", then Feed: three selfies landing live. |
| 0:50 | P1 | "Alex isn't here." → dev → "End window now" | — |
| 0:55 | — | — | Feed: red card "Alex skipped 15-122 · circle streak 8 → 0", counter animates to 💀 0, amber card "Alex owes the circle boba". |
| 1:05 | P4 | Modal already open → type "slept in" → Post | Feed: "Alex: slept in" under the skip. |
| 1:20 | P2 | Feed → forfeit card → Mark paid (holding the boba) | Feed: green "Alex paid up · confirmed by Sam". |
| 1:30 | P1 | — | Close: circle-only, 24h photos, no coordinates stored; friction not proof; the app keeps score, friends collect. |

Fallbacks, in order of likelihood:
- **Live dot goes grey / cards arrive late:** do nothing. The state fetch runs every 5 s regardless and tightens to 2 s when the channel drops. If a card still hasn't shown, pull to refresh on P1.
- **P2 or P3 cannot check in (camera, GPS, upload):** P1 dev → "Replay: check in as P2" / "as P3". Server inserts the check-in with a seed photo; the feed card looks identical.
- **P4's modal does not appear:** P4 opens Feed → skip card → "Explain". If P4 is dead entirely: P1 dev → "Replay: post Alex's explanation".
- **"Mark paid" fails on P2:** P1 dev → "Replay: pay Alex's forfeit" (runs as a non-owner member).
- **Backend unreachable:** play the H18 video from the laptop desktop and narrate over it. The video and a screenshot deck of the sequence sit on the desktop before the slot.

Never during the slot: sign in, edit schedules, join the circle, or run the seed.

## 12. Open questions to settle before H1

Only those that change the schema or the stack:

1. **One circle per user?** Recommend yes. Removes circle pickers everywhere and lets `my_circle_id()` drive all RLS. If no: drop the unique index, add a circle selector, and `skips`/`forfeits` need a circle per row for every circle the user is in.
2. **Auth: email + password (confirmation off) or Supabase anonymous sign-in + display name?** Recommend email + password. Anonymous sessions are lost when Expo Go clears data, which would kill a phone mid-demo.
3. **Which course is the demo course, and does every teammate really take it?** If invented, it goes in everyone's seed schedule with no real occurrences today. Determines `dev_start_class_now` and the seed.
4. **Do we build after-the-fact excuses?** Recommend yes (one trigger branch and one button); it adds the `voided` forfeit state. If no, `forfeit_status` is just `owed|paid` and the excuse link exists only on pending Home cards.
5. **Dual capture: sequential front-then-back or front only?** Recommend front only until H12, keep `photo_back_path` either way. Sequential capture on `CameraView` needs a facing switch mid-flow, which is the riskiest camera code.
6. **Is Expo Go a hard constraint, or is an EAS development build acceptable?** Recommend Expo Go stays hard. A dev build unlocks real server push (`push_tokens`, pg_net) but costs an Apple developer account, device registration, and a 20-minute build per iteration.
7. **Does the circle streak count a day when some members had no class?** Our definition says yes, and an excused-only day counts as attended. Changing either changes the streak SQL, not the schema.
