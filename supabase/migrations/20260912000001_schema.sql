-- Present — schema
-- Everything lives in public. RLS is enabled in 20260912000003_policies.sql.

create type public.occ_status     as enum ('pending', 'checked_in', 'skipped', 'excused');
create type public.forfeit_status as enum ('owed', 'paid', 'voided');
create type public.feed_type      as enum ('checkin', 'skip', 'excused', 'explanation',
                                           'forfeit_owed', 'forfeit_paid', 'member_joined');

create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

create table public.circles (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  forfeit_text text not null,                 -- preset label or custom text
  invite_code  text not null unique,          -- 6 uppercase chars, no ambiguous glyphs
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

create table public.circle_members (
  circle_id uuid not null references public.circles(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);
-- v1 rule: one circle per user. Drop this index to allow many.
create unique index circle_members_one_per_user on public.circle_members (user_id);

create table public.buildings (
  code     text primary key,                  -- 'GHC'
  name     text not null,
  lat      double precision not null,
  lng      double precision not null,
  radius_m int not null default 100
);

create table public.classes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  course_code   text not null,                -- '15-122'
  name          text,
  building_code text not null references public.buildings(code),
  days_of_week  smallint[] not null,          -- 0=Sun .. 6=Sat
  start_time    time not null,                -- local America/New_York
  end_time      time not null,
  created_at    timestamptz not null default now(),
  constraint classes_time_order check (end_time > start_time)
);
create index classes_by_user on public.classes (user_id);

create table public.class_occurrences (
  id               uuid primary key default gen_random_uuid(),
  class_id         uuid not null references public.classes(id) on delete cascade,
  user_id          uuid not null references public.profiles(id) on delete cascade,
  building_code    text not null references public.buildings(code),  -- copied from class; dev sets 'DEMO'
  date             date not null,             -- local NY date
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  window_start     timestamptz not null,      -- starts_at - 10 min
  window_end       timestamptz not null,      -- starts_at + 15 min
  skip_deadline    timestamptz not null,      -- ends_at + 10 min
  status           public.occ_status not null default 'pending',
  reminder_sent_at timestamptz,               -- only used if remote push ever exists
  is_demo          boolean not null default false,
  created_at       timestamptz not null default now()
);
create unique index occ_one_per_class_day on public.class_occurrences (class_id, date) where not is_demo;
create index occ_pending_deadline on public.class_occurrences (skip_deadline) where status = 'pending';
create index occ_by_user_date on public.class_occurrences (user_id, date);

create table public.checkins (
  id              uuid primary key default gen_random_uuid(),
  occurrence_id   uuid not null unique references public.class_occurrences(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  photo_path      text,                       -- storage path in bucket 'checkin-photos'; null once expired
  photo_back_path text,
  in_geofence     boolean not null default false,   -- never coordinates
  expires_at      timestamptz not null default now() + interval '24 hours',  -- 24h photo expiry hook
  created_at      timestamptz not null default now()
);

create table public.skips (
  id            uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null unique references public.class_occurrences(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  circle_id     uuid not null references public.circles(id) on delete cascade,
  excused       boolean not null default false,
  explanation   text,
  created_at    timestamptz not null default now()
);

create table public.forfeits (
  id             uuid primary key default gen_random_uuid(),
  circle_id      uuid not null references public.circles(id) on delete cascade,
  owed_by        uuid not null references public.profiles(id) on delete cascade,
  skip_id        uuid not null references public.skips(id) on delete cascade,
  description    text not null,               -- copied from circles.forfeit_text at creation
  status         public.forfeit_status not null default 'owed',
  marked_paid_by uuid references public.profiles(id) on delete set null,
  paid_at        timestamptz,
  local_date     date not null,               -- NY date of the skipped class
  created_at     timestamptz not null default now()
);
-- one forfeit per person per day; voided ones don't count against the cap
create unique index forfeit_one_per_day on public.forfeits (circle_id, owed_by, local_date) where status <> 'voided';

create table public.feed_events (
  id            uuid primary key default gen_random_uuid(),
  circle_id     uuid not null references public.circles(id) on delete cascade,
  actor_id      uuid not null references public.profiles(id) on delete cascade,
  occurrence_id uuid references public.class_occurrences(id) on delete cascade,  -- lets dev_reset cascade
  type          public.feed_type not null,
  ref_id        uuid,                         -- checkins.id / skips.id / forfeits.id
  payload       jsonb not null default '{}'::jsonb,  -- denormalized display data (see PLAN.md §2)
  created_at    timestamptz not null default now()
);
create index feed_by_circle on public.feed_events (circle_id, created_at desc);

create table public.reactions (
  id            uuid primary key default gen_random_uuid(),
  feed_event_id uuid not null references public.feed_events(id) on delete cascade,
  circle_id     uuid not null references public.circles(id) on delete cascade,  -- for the realtime filter
  user_id       uuid not null references public.profiles(id) on delete cascade,
  emoji         text not null,
  created_at    timestamptz not null default now(),
  unique (feed_event_id, user_id, emoji)
);

create table public.push_tokens (               -- kept for a future dev build; unused in Expo Go
  token      text primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  platform   text,
  updated_at timestamptz not null default now()
);

-- Mirror auth.users into profiles.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(coalesce(new.email, 'someone'), '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
