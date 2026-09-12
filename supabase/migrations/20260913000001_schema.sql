-- Present v2 — schema
-- Friends instead of circles, posts with an on-time/late/miss window, comments, per-user time
-- zones, calendar-imported classes. Everything lives in public; RLS is in 20260913000003_policies.sql.

-- One notion of "now" for every default and comparison. The PGlite test moves it with
-- set_config('present.now', ...); PostgREST exposes no set_config, so clients cannot.
create or replace function public.app_now() returns timestamptz
language sql stable as $$
  select coalesce(nullif(current_setting('present.now', true), '')::timestamptz, now())
$$;

create or replace function public.valid_tz(p_tz text) returns boolean
language plpgsql stable as $$
begin
  if p_tz is null or p_tz = '' or length(p_tz) > 64 then return false; end if;
  perform timestamptz '2000-01-01 00:00:00+00' at time zone p_tz;
  return true;
exception when others then
  return false;
end $$;

create type public.occ_status    as enum ('pending', 'posted', 'missed', 'excused');
create type public.feed_type     as enum ('post', 'miss', 'excused', 'explanation', 'friends');
create type public.friend_status as enum ('pending', 'accepted');

-- ---------------------------------------------------------------- people

create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text not null unique,
  display_name text not null,
  avatar_url   text,
  tz           text not null default 'UTC',   -- IANA zone from the device at sign-up
  created_at   timestamptz not null default public.app_now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,20}$')
);

-- One row per pair, canonical order, so a request and its reverse are the same row.
-- Decline, cancel and unfriend all delete the row; re-requesting starts fresh.
create table public.friendships (
  user_lo      uuid not null references public.profiles(id) on delete cascade,
  user_hi      uuid not null references public.profiles(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  status       public.friend_status not null default 'pending',
  created_at   timestamptz not null default public.app_now(),
  accepted_at  timestamptz,
  primary key (user_lo, user_hi),
  constraint friendships_order check (user_lo < user_hi),
  constraint friendships_requester check (requested_by in (user_lo, user_hi))
);
create index friendships_by_hi on public.friendships (user_hi);

-- ---------------------------------------------------------------- schedule

create table public.classes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  course_code   text not null,                -- '15-122', 'CS 61A'
  name          text,
  location_text text,                         -- free text from the calendar: 'GHC 4401', 'Zoom'
  lat           double precision,             -- the pinned room (set by the first on-time post)
  lng           double precision,
  radius_m      int,
  tz            text not null,                -- filled from the profile by the trigger below when null
  days_of_week  smallint[] not null,          -- 0=Sun .. 6=Sat, local calendar days
  start_time    time not null,                -- wall clock in tz
  end_time      time not null,
  term_start    date,
  term_end      date,
  exdates       date[] not null default '{}', -- holidays and cancelled sessions
  source        text not null default 'manual' check (source in ('manual', 'ics')),
  ics_uid       text,                         -- for idempotent re-import
  created_at    timestamptz not null default public.app_now(),
  constraint classes_time_order check (end_time > start_time),
  constraint classes_days_valid check (cardinality(days_of_week) >= 1)
);
create index classes_by_user on public.classes (user_id);
create unique index classes_user_ics on public.classes (user_id, ics_uid) where ics_uid is not null;

create or replace function public.on_class_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.tz is null or new.tz = '' then
    select tz into new.tz from public.profiles where id = new.user_id;
  end if;
  if not public.valid_tz(coalesce(new.tz, '')) then raise exception 'Unknown time zone %', new.tz; end if;
  new.course_code := left(trim(new.course_code), 32);
  if new.course_code = '' then raise exception 'A course code is required'; end if;
  if exists (select 1 from unnest(new.days_of_week) d where d < 0 or d > 6) then raise exception 'Days must be 0 to 6'; end if;
  return new;
end $$;

create trigger classes_before_write
  before insert or update on public.classes
  for each row execute function public.on_class_before_write();

create table public.class_occurrences (
  id            uuid primary key default gen_random_uuid(),
  class_id      uuid not null references public.classes(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  date          date not null,                -- local day in the class tz; streaks group by this
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  opens_at      timestamptz not null,         -- starts_at - 2 min: posting allowed from here
  on_time_until timestamptz not null,         -- starts_at + 10 min: posts before this are on time
  deadline      timestamptz not null,         -- ends_at + 10 min: late allowed until here; then a miss
  status        public.occ_status not null default 'pending',
  late          boolean not null default false,
  posted_at     timestamptz,
  is_demo       boolean not null default false,
  created_at    timestamptz not null default public.app_now()
);
create unique index occ_one_per_class_day on public.class_occurrences (class_id, date) where not is_demo;
create index occ_pending_deadline on public.class_occurrences (deadline) where status = 'pending';
create index occ_by_user_date on public.class_occurrences (user_id, date);

-- ---------------------------------------------------------------- posts and misses

create table public.posts (
  id                uuid primary key default gen_random_uuid(),
  occurrence_id     uuid not null unique references public.class_occurrences(id) on delete cascade,
  user_id           uuid not null references public.profiles(id) on delete cascade,
  photo_path        text,                     -- storage path in 'checkin-photos'; null once expired
  photo_back_path   text,
  caption           text check (caption is null or length(caption) <= 140),
  late              boolean not null default false,
  location_verified boolean not null default false,  -- "Nearby": within the class pin at post time
  retake_count      int not null default 0,
  expires_at        timestamptz not null,     -- friends stop seeing the photo (24 h)
  memory_until      timestamptz not null,     -- the author keeps it as a memory (30 d)
  created_at        timestamptz not null default public.app_now()
);
create index posts_by_user on public.posts (user_id, created_at desc);

create table public.misses (
  id            uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null unique references public.class_occurrences(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  excused       boolean not null default false,
  explanation   text,
  created_at    timestamptz not null default public.app_now()
);

-- ---------------------------------------------------------------- feed

-- Audience is derived at read time: an event is visible to its actor and the actor's friends.
create table public.feed_events (
  id            uuid primary key default gen_random_uuid(),
  actor_id      uuid not null references public.profiles(id) on delete cascade,
  occurrence_id uuid references public.class_occurrences(id) on delete cascade,  -- lets dev_reset cascade
  type          public.feed_type not null,
  ref_id        uuid,                         -- posts.id / misses.id / the friend's id
  payload       jsonb not null default '{}'::jsonb,  -- denormalized display data (payload contract v2)
  created_at    timestamptz not null default public.app_now()
);
create index feed_by_actor on public.feed_events (actor_id, created_at desc);
create index feed_by_time on public.feed_events (created_at desc);

create table public.reactions (
  id            uuid primary key default gen_random_uuid(),
  feed_event_id uuid not null references public.feed_events(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  emoji         text not null,
  created_at    timestamptz not null default public.app_now(),
  unique (feed_event_id, user_id, emoji)
);

create table public.comments (
  id            uuid primary key default gen_random_uuid(),
  feed_event_id uuid not null references public.feed_events(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  text          text not null check (length(text) between 1 and 200),
  created_at    timestamptz not null default public.app_now()
);
create index comments_by_event on public.comments (feed_event_id, created_at);

-- Web Push (stretch). One row per browser subscription.
create table public.push_subscriptions (
  endpoint   text primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default public.app_now()
);
create index push_by_user on public.push_subscriptions (user_id);

-- ---------------------------------------------------------------- auth mirror

-- A username that is valid and free, derived from the requested one or the email local part.
create or replace function public.pick_username(p_wanted text, p_email text) returns text
language plpgsql security definer set search_path = public as $$
declare base text; candidate text; i int := 0;
begin
  base := lower(regexp_replace(coalesce(nullif(trim(p_wanted), ''), split_part(coalesce(p_email, ''), '@', 1)), '[^a-z0-9_]', '', 'g'));
  if length(base) < 3 then base := rpad(coalesce(nullif(base, ''), 'user'), 3, '0'); end if;
  base := left(base, 20);
  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    i := i + 1;
    if i > 50 then raise exception 'Could not pick a username'; end if;
    candidate := left(base, 17) || lpad((floor(random() * 1000))::int::text, 3, '0');
  end loop;
  return candidate;
end $$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare tz text;
begin
  tz := new.raw_user_meta_data ->> 'tz';
  if not public.valid_tz(coalesce(tz, '')) then tz := 'UTC'; end if;
  insert into public.profiles (id, username, display_name, avatar_url, tz)
  values (
    new.id,
    public.pick_username(new.raw_user_meta_data ->> 'username', new.email),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(coalesce(new.email, 'someone'), '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url',
    tz
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
