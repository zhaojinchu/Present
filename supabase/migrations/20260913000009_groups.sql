-- Present v2 — groups
-- Group chats for showing up: up to 8 people who see each other's classes, posts and misses,
-- keep a shared streak, and hold each other to a forfeit. Friends stay as they are; groups sit
-- alongside them. Join by invite code (anyone) or by being added by a friend who is a member.
--
-- Seven mechanics, all read through get_state().groups[] (web/src/lib/groups.ts is the mirror):
--   group streak   group_streak / group_best_streak over the members' occurrences by date
--   roll call      co-members flow through visible_users(), so today_occurrences carries them
--   standings      per-member term totals; week = sum over members Monday..today in my tz
--   stakes         a miss by a member of a group with forfeit_text creates an "owed" forfeit;
--                  any other member marks it paid; an excuse of any kind voids it
--   excuse voting  vote_miss(): fair votes > (members - 1) / 2 excuses the miss for the group
--   vouch          vouch_miss(): one vouch from any other member excuses it at once
--   suggestions    shared_courses[]: my active courses and the accepted friends who take them
-- Personal streaks never look at group excuses; only the group streak and forfeits do.

create type public.forfeit_status as enum ('owed', 'paid', 'voided');

create table public.groups (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(name) between 1 and 40),
  emoji        text check (emoji is null or length(emoji) <= 8),
  invite_code  text not null unique check (invite_code ~ '^[A-Z0-9]{6}$'),
  forfeit_text text check (forfeit_text is null or length(forfeit_text) <= 80),
  created_by   uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default public.app_now()
);

create table public.group_members (
  group_id  uuid not null references public.groups(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default public.app_now(),
  primary key (group_id, user_id)
);
create index group_members_by_user on public.group_members (user_id);

create table public.group_forfeits (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups(id) on delete cascade,
  miss_id    uuid not null references public.misses(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,   -- who owes
  status     public.forfeit_status not null default 'owed',
  paid_by    uuid references public.profiles(id) on delete set null,
  paid_at    timestamptz,
  created_at timestamptz not null default public.app_now(),
  unique (group_id, miss_id)
);
create index group_forfeits_by_group on public.group_forfeits (group_id, created_at desc);

create table public.miss_votes (
  miss_id    uuid not null references public.misses(id) on delete cascade,
  group_id   uuid not null references public.groups(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  fair       boolean not null,
  created_at timestamptz not null default public.app_now(),
  primary key (miss_id, group_id, user_id)
);

create table public.miss_vouches (
  miss_id    uuid not null references public.misses(id) on delete cascade,
  group_id   uuid not null references public.groups(id) on delete cascade,
  voucher_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default public.app_now(),
  primary key (miss_id, group_id, voucher_id)
);

-- ---------------------------------------------------------------- visibility

create or replace function public.my_group_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select group_id from public.group_members where user_id = auth.uid()
$$;

create or replace function public.group_mates(p_user uuid) returns setof uuid
language sql stable security definer set search_path = public as $$
  select distinct gm2.user_id
  from public.group_members gm
  join public.group_members gm2 on gm2.group_id = gm.group_id and gm2.user_id <> p_user
  where gm.user_id = p_user
$$;

-- Me, my accepted friends, and everyone who shares a group with me. Every read policy and
-- get_state()'s today_occurrences / feed go through this, so co-members see each other's
-- classes, posts and misses without being friends. The friends list and leaderboard stay
-- friends-only (friends_of).
create or replace function public.visible_users() returns setof uuid
language sql stable security definer set search_path = public as $$
  select auth.uid()
  union select public.friends_of(auth.uid())
  union select public.group_mates(auth.uid())
$$;

create or replace function public.is_group_member(p_group uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.group_members where group_id = p_group and user_id = p_user)
$$;

alter table public.groups         enable row level security;
alter table public.group_members  enable row level security;
alter table public.group_forfeits enable row level security;
alter table public.miss_votes     enable row level security;
alter table public.miss_vouches   enable row level security;

create policy groups_select on public.groups for select to authenticated
  using (id in (select public.my_group_ids()));
create policy group_members_select on public.group_members for select to authenticated
  using (group_id in (select public.my_group_ids()));
create policy group_forfeits_select on public.group_forfeits for select to authenticated
  using (group_id in (select public.my_group_ids()));
create policy miss_votes_select on public.miss_votes for select to authenticated
  using (group_id in (select public.my_group_ids()));
create policy miss_vouches_select on public.miss_vouches for select to authenticated
  using (group_id in (select public.my_group_ids()));

-- ---------------------------------------------------------------- helpers

-- Six characters, no 0/O/1/I, unique.
create or replace function public.gen_invite_code() returns text
language plpgsql security definer set search_path = public as $$
declare alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; code text; i int;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.groups where invite_code = code);
  end loop;
  return code;
end $$;

-- Excused by the group: one vouch, or a majority of the other members voting "fair". Only votes
-- and vouches from current members count.
create or replace function public.miss_group_excused(p_miss uuid, p_group uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
      select 1 from public.miss_vouches v
      join public.group_members gm on gm.group_id = v.group_id and gm.user_id = v.voucher_id
      where v.miss_id = p_miss and v.group_id = p_group)
    or (
      select count(*) from public.miss_votes v
      join public.group_members gm on gm.group_id = v.group_id and gm.user_id = v.user_id
      where v.miss_id = p_miss and v.group_id = p_group and v.fair)
      > ((select count(*) from public.group_members where group_id = p_group) - 1) / 2
$$;

create or replace function public.void_forfeit(p_miss uuid, p_group uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.group_forfeits set status = 'voided'
   where miss_id = p_miss and group_id = p_group and status = 'owed';
end $$;

-- ---------------------------------------------------------------- stakes

-- A new (unexcused) miss owes the forfeit in every group of the misser that has one; an excuse
-- of any kind (the misser's own, the group's vote, a vouch) voids what is still owed.
create or replace function public.on_miss_group_effects() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if not new.excused then
      insert into public.group_forfeits (group_id, miss_id, user_id, created_at)
      select gm.group_id, new.id, new.user_id, public.app_now()
      from public.group_members gm
      join public.groups g on g.id = gm.group_id
      where gm.user_id = new.user_id and g.forfeit_text is not null
      on conflict (group_id, miss_id) do nothing;
    end if;
  elsif tg_op = 'UPDATE' and new.excused and not old.excused then
    update public.group_forfeits set status = 'voided' where miss_id = new.id and status = 'owed';
  end if;
  return new;
end $$;

create trigger misses_group_effects
  after insert or update on public.misses
  for each row execute function public.on_miss_group_effects();

-- ---------------------------------------------------------------- group streak

-- One row per calendar day with any occurrence of a current member. Broken: a member missed
-- (or is past a deadline without posting) and the group did not excuse it. Complete: every
-- occurrence that day is on time, excused, or a group-excused miss. Late posts and pending
-- classes leave the day undecided, exactly like personal_streak.
create or replace function public.group_days(p_group uuid)
returns table (d date, broken boolean, complete boolean)
language sql stable security definer set search_path = public as $$
  select o.date,
         bool_or((o.status = 'missed' and not public.miss_group_excused(m.id, p_group))
                 or (o.status = 'pending' and o.deadline <= public.app_now())) as broken,
         bool_and(o.status = 'excused'
                  or (o.status = 'posted' and not o.late)
                  or (o.status = 'missed' and public.miss_group_excused(m.id, p_group))) as complete
  from public.group_members gm
  join public.class_occurrences o on o.user_id = gm.user_id
  left join public.misses m on m.occurrence_id = o.id
  where gm.group_id = p_group
  group by o.date
$$;

create or replace function public.group_streak(p_group uuid) returns int
language sql stable security definer set search_path = public as $$
  with decided as (
    select broken, row_number() over (order by d desc) as rn
    from public.group_days(p_group) where broken or complete
  )
  select count(*)::int from decided
  where rn < coalesce((select min(rn) from decided where broken), 2147483647)
$$;

create or replace function public.group_best_streak(p_group uuid) returns int
language sql stable security definer set search_path = public as $$
  with decided as (
    select d, broken from public.group_days(p_group) where broken or complete
  ), runs as (
    select broken, sum(case when broken then 1 else 0 end) over (order by d) as grp from decided
  )
  select coalesce(max(cnt), 0)::int
  from (select grp, count(*) filter (where not broken) as cnt from runs group by grp) x
$$;

-- ---------------------------------------------------------------- the group object

-- Everything the client shows for one group. p_today / p_week_start are the viewer's local days.
-- made = posted (on time or late); total = made + missed (excused classes are outside both);
-- missed counts a pending class past its deadline before detect_misses runs, like get_stats.
create or replace function public.group_json(p_group uuid, p_today date, p_week_start date, p_now timestamptz) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare g public.groups; since timestamptz := p_now - interval '14 days';
begin
  select * into g from public.groups where id = p_group;
  if g.id is null then return null; end if;
  return jsonb_build_object(
    'id', g.id, 'name', g.name, 'emoji', g.emoji, 'invite_code', g.invite_code, 'forfeit_text', g.forfeit_text,
    'created_by', g.created_by, 'created_at', g.created_at,
    'members', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', p.id, 'username', p.username, 'display_name', p.display_name, 'avatar_url', p.avatar_url,
               'streak', public.personal_streak(p.id),
               'posted_today', exists (select 1 from public.class_occurrences o where o.user_id = p.id and o.date = p_today and o.status = 'posted'))
               order by gm.joined_at, p.display_name), '[]'::jsonb)
      from public.group_members gm join public.profiles p on p.id = gm.user_id where gm.group_id = g.id),
    'streak', public.group_streak(g.id),
    'best_streak', public.group_best_streak(g.id),
    'week', (
      select jsonb_build_object(
        'made',     count(o.id) filter (where o.status = 'posted'),
        'total',    count(o.id) filter (where o.status = 'posted' or o.status = 'missed' or (o.status = 'pending' and o.deadline <= p_now)),
        'on_time',  count(o.id) filter (where o.status = 'posted' and not o.late),
        'late',     count(o.id) filter (where o.status = 'posted' and o.late),
        'missed',   count(o.id) filter (where o.status = 'missed' or (o.status = 'pending' and o.deadline <= p_now)),
        'upcoming', count(o.id) filter (where o.status = 'pending' and o.deadline > p_now))
      from public.group_members gm
      left join public.class_occurrences o on o.user_id = gm.user_id and o.date between p_week_start and p_today
      where gm.group_id = g.id),
    'standings', (
      select coalesce(jsonb_agg(x order by (x ->> 'made')::int desc, (x ->> 'on_time')::int desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id', gm.user_id,
          'made',    count(o.id) filter (where o.status = 'posted'),
          'total',   count(o.id) filter (where o.status = 'posted' or o.status = 'missed' or (o.status = 'pending' and o.deadline <= p_now)),
          'on_time', count(o.id) filter (where o.status = 'posted' and not o.late),
          'late',    count(o.id) filter (where o.status = 'posted' and o.late),
          'missed',  count(o.id) filter (where o.status = 'missed' or (o.status = 'pending' and o.deadline <= p_now))) as x
        from public.group_members gm
        left join public.class_occurrences o on o.user_id = gm.user_id and o.date <= p_today
        where gm.group_id = g.id
        group by gm.user_id) s),
    'forfeits', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', f.id, 'miss_id', f.miss_id, 'user_id', f.user_id, 'status', f.status, 'paid_by', f.paid_by,
               'paid_at', f.paid_at, 'created_at', f.created_at, 'course_code', c.course_code, 'starts_at', o.starts_at)
               order by f.created_at desc), '[]'::jsonb)
      from public.group_forfeits f
      join public.misses m on m.id = f.miss_id
      join public.class_occurrences o on o.id = m.occurrence_id
      join public.classes c on c.id = o.class_id
      where f.group_id = g.id and f.created_at >= since),
    'votes', (
      select coalesce(jsonb_agg(jsonb_build_object('miss_id', v.miss_id, 'user_id', v.user_id, 'fair', v.fair)), '[]'::jsonb)
      from public.miss_votes v join public.misses m on m.id = v.miss_id
      where v.group_id = g.id and m.created_at >= since),
    'vouches', (
      select coalesce(jsonb_agg(jsonb_build_object('miss_id', v.miss_id, 'voucher_id', v.voucher_id)), '[]'::jsonb)
      from public.miss_vouches v join public.misses m on m.id = v.miss_id
      where v.group_id = g.id and m.created_at >= since),
    'excused_miss_ids', (
      select coalesce(jsonb_agg(m.id), '[]'::jsonb)
      from public.misses m
      join public.group_members gm on gm.group_id = g.id and gm.user_id = m.user_id
      where m.created_at >= since and public.miss_group_excused(m.id, g.id))
  );
end $$;

-- The same object as the caller sees it in get_state(); what every group RPC returns.
create or replace function public.group_state(p_group uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); z text; today date; t timestamptz := public.app_now();
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if not public.is_group_member(p_group, uid) then raise exception 'You are not in this group'; end if;
  select tz into z from public.profiles where id = uid;
  today := public.local_today(coalesce(z, 'UTC'));
  return public.group_json(p_group, today, today - (extract(isodow from today)::int - 1), t);
end $$;

-- ---------------------------------------------------------------- membership RPCs

create or replace function public.create_group(p_name text, p_emoji text default null, p_forfeit_text text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); gid uuid; nm text; t timestamptz := public.app_now();
begin
  if uid is null then raise exception 'Not signed in'; end if;
  nm := left(trim(coalesce(p_name, '')), 40);
  if nm = '' then raise exception 'Give the group a name'; end if;
  insert into public.groups (name, emoji, invite_code, forfeit_text, created_by, created_at)
  values (nm, nullif(left(trim(coalesce(p_emoji, '')), 8), ''), public.gen_invite_code(),
          nullif(left(trim(coalesce(p_forfeit_text, '')), 80), ''), uid, t)
  returning id into gid;
  insert into public.group_members (group_id, user_id, joined_at) values (gid, uid, t);
  return public.group_state(gid);
end $$;

-- Anyone with the code, friend or not. Joining twice just returns the group.
create or replace function public.join_group(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); g public.groups; t timestamptz := public.app_now();
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select * into g from public.groups where invite_code = upper(trim(coalesce(p_code, ''))) for update;
  if g.id is null then raise exception 'No group has that code'; end if;
  if public.is_group_member(g.id, uid) then return public.group_state(g.id); end if;
  if (select count(*) from public.group_members where group_id = g.id) >= 8 then raise exception 'This group is full (8 people)'; end if;
  insert into public.group_members (group_id, user_id, joined_at) values (g.id, uid, t);
  return public.group_state(g.id);
end $$;

-- A member adds one of their accepted friends.
create or replace function public.add_to_group(p_group_id uuid, p_user_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); t timestamptz := public.app_now();
begin
  if uid is null then raise exception 'Not signed in'; end if;
  perform 1 from public.groups where id = p_group_id for update;
  if not found then raise exception 'No such group'; end if;
  if not public.is_group_member(p_group_id, uid) then raise exception 'You are not in this group'; end if;
  if p_user_id = uid then raise exception 'You are already in this group'; end if;
  if not (p_user_id in (select public.friends_of(uid))) then raise exception 'You can only add friends'; end if;
  if public.is_group_member(p_group_id, p_user_id) then return public.group_state(p_group_id); end if;
  if (select count(*) from public.group_members where group_id = p_group_id) >= 8 then raise exception 'This group is full (8 people)'; end if;
  insert into public.group_members (group_id, user_id, joined_at) values (p_group_id, p_user_id, t);
  return public.group_state(p_group_id);
end $$;

-- Leaving as the last member deletes the group (and, by cascade, its forfeits, votes, vouches).
create or replace function public.leave_group(p_group_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not signed in'; end if;
  delete from public.group_members where group_id = p_group_id and user_id = uid;
  if not found then raise exception 'You are not in this group'; end if;
  if not exists (select 1 from public.group_members where group_id = p_group_id) then
    delete from public.groups where id = p_group_id;
    return true;
  end if;
  return false;
end $$;

-- Creator only. An empty emoji or forfeit clears it; an empty name keeps the old one.
create or replace function public.update_group(p_group_id uuid, p_name text default null, p_emoji text default null, p_forfeit_text text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not signed in'; end if;
  update public.groups
     set name = coalesce(nullif(left(trim(coalesce(p_name, '')), 40), ''), name),
         emoji = nullif(left(trim(coalesce(p_emoji, '')), 8), ''),
         forfeit_text = nullif(left(trim(coalesce(p_forfeit_text, '')), 80), '')
   where id = p_group_id and created_by = uid;
  if not found then raise exception 'Only the person who made the group can change it'; end if;
  return public.group_state(p_group_id);
end $$;

-- ---------------------------------------------------------------- stakes, votes, vouches

create or replace function public.mark_forfeit_paid(p_forfeit_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); f public.group_forfeits; t timestamptz := public.app_now();
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select * into f from public.group_forfeits where id = p_forfeit_id for update;
  if f.id is null or not public.is_group_member(f.group_id, uid) then raise exception 'No such forfeit'; end if;
  if f.user_id = uid then raise exception 'Someone else has to confirm you paid'; end if;
  if f.status <> 'owed' then raise exception 'This forfeit is already %', f.status; end if;
  update public.group_forfeits set status = 'paid', paid_by = uid, paid_at = t where id = f.id;
  return jsonb_build_object('id', f.id, 'status', 'paid', 'paid_by', uid, 'paid_at', t);
end $$;

-- Shared checks for a vote or a vouch: the miss belongs to a co-member, and it is not mine.
create or replace function public.check_miss_in_group(p_miss_id uuid, p_group_id uuid, p_uid uuid) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare owner uuid;
begin
  if p_uid is null then raise exception 'Not signed in'; end if;
  if not public.is_group_member(p_group_id, p_uid) then raise exception 'You are not in this group'; end if;
  select user_id into owner from public.misses where id = p_miss_id;
  if owner is null then raise exception 'No such miss'; end if;
  if owner = p_uid then raise exception 'You cannot judge your own miss'; end if;
  if not public.is_group_member(p_group_id, owner) then raise exception 'That miss is not in this group'; end if;
  return owner;
end $$;

create or replace function public.vote_miss(p_miss_id uuid, p_group_id uuid, p_fair boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); excused boolean; t timestamptz := public.app_now();
begin
  perform public.check_miss_in_group(p_miss_id, p_group_id, uid);
  insert into public.miss_votes (miss_id, group_id, user_id, fair, created_at)
  values (p_miss_id, p_group_id, uid, coalesce(p_fair, false), t)
  on conflict (miss_id, group_id, user_id) do update set fair = excluded.fair, created_at = excluded.created_at;
  excused := public.miss_group_excused(p_miss_id, p_group_id);
  if excused then perform public.void_forfeit(p_miss_id, p_group_id); end if;
  return jsonb_build_object(
    'excused', excused,
    'fair',   (select count(*) from public.miss_votes where miss_id = p_miss_id and group_id = p_group_id and fair),
    'unfair', (select count(*) from public.miss_votes where miss_id = p_miss_id and group_id = p_group_id and not fair));
end $$;

create or replace function public.vouch_miss(p_miss_id uuid, p_group_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); t timestamptz := public.app_now();
begin
  perform public.check_miss_in_group(p_miss_id, p_group_id, uid);
  insert into public.miss_vouches (miss_id, group_id, voucher_id, created_at)
  values (p_miss_id, p_group_id, uid, t)
  on conflict do nothing;
  perform public.void_forfeit(p_miss_id, p_group_id);
  return jsonb_build_object('excused', true);
end $$;

-- ---------------------------------------------------------------- get_state

-- Same as 000002 plus groups[] and shared_courses[]; friends now come from friends_of() because
-- visible_users() also carries co-members.
create or replace function public.get_state() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); me public.profiles; today date; week_start date; vis uuid[]; recent uuid[]; t timestamptz := public.app_now();
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select * into me from public.profiles where id = uid;
  if me.id is null then raise exception 'No profile'; end if;
  today := public.local_today(me.tz);
  week_start := today - (extract(isodow from today)::int - 1);
  select coalesce(array_agg(u), '{}'::uuid[]) into vis from public.visible_users() u;
  select coalesce(array_agg(r.id), '{}'::uuid[]) into recent
    from (select id from public.feed_events where actor_id = any (vis) order by created_at desc limit 50) r;

  return jsonb_build_object(
    'server_time', t,
    'today', today,
    'me', jsonb_build_object(
      'id', me.id, 'username', me.username, 'display_name', me.display_name, 'avatar_url', me.avatar_url, 'tz', me.tz,
      'streak', public.personal_streak(uid), 'best_streak', public.best_streak(uid),
      'posts_count', (select count(*) from public.posts where user_id = uid),
      'class_count', (select count(*) from public.classes where user_id = uid and (term_end is null or term_end >= today)),
      'posted_today', exists (select 1 from public.class_occurrences where user_id = uid and date = today and status = 'posted'),
      'has_class_today', exists (select 1 from public.class_occurrences where user_id = uid and date = today)),
    'friends', (
      select coalesce(jsonb_agg(x order by (x ->> 'streak')::int desc, x ->> 'display_name'), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id', p.id, 'username', p.username, 'display_name', p.display_name, 'avatar_url', p.avatar_url,
          'streak', public.personal_streak(p.id), 'best_streak', public.best_streak(p.id),
          'posted_today', exists (select 1 from public.class_occurrences o where o.user_id = p.id and o.date = today and o.status = 'posted')) as x
        from public.profiles p where p.id in (select public.friends_of(uid))) s),
    'requests', jsonb_build_object(
      'incoming', (
        select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'username', p.username, 'display_name', p.display_name,
                 'avatar_url', p.avatar_url, 'created_at', f.created_at) order by f.created_at desc), '[]'::jsonb)
        from public.friendships f join public.profiles p on p.id = f.requested_by
        where f.status = 'pending' and uid in (f.user_lo, f.user_hi) and f.requested_by <> uid),
      'outgoing', (
        select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'username', p.username, 'display_name', p.display_name,
                 'avatar_url', p.avatar_url, 'created_at', f.created_at) order by f.created_at desc), '[]'::jsonb)
        from public.friendships f
        join public.profiles p on p.id = case when f.user_lo = uid then f.user_hi else f.user_lo end
        where f.status = 'pending' and f.requested_by = uid)),
    'today_occurrences', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', o.id, 'user_id', o.user_id, 'username', p.username, 'display_name', p.display_name, 'avatar_url', p.avatar_url,
               'class_id', c.id, 'course_code', c.course_code, 'name', c.name, 'location_text', c.location_text,
               'lat', c.lat, 'lng', c.lng, 'radius_m', c.radius_m,
               'date', o.date, 'starts_at', o.starts_at, 'ends_at', o.ends_at, 'opens_at', o.opens_at,
               'on_time_until', o.on_time_until, 'deadline', o.deadline,
               'status', o.status, 'late', o.late, 'posted_at', o.posted_at, 'is_demo', o.is_demo,
               'post', (select jsonb_build_object('id', ps.id, 'photo_path', ps.photo_path, 'photo_back_path', ps.photo_back_path,
                          'caption', ps.caption, 'late', ps.late, 'location_verified', ps.location_verified,
                          'retake_count', ps.retake_count, 'expires_at', ps.expires_at)
                        from public.posts ps where ps.occurrence_id = o.id)) order by o.starts_at, p.display_name), '[]'::jsonb)
      from public.class_occurrences o
      join public.classes c on c.id = o.class_id
      join public.profiles p on p.id = o.user_id
      where o.user_id = any (vis) and o.date = today),
    'my_unexplained_misses', (
      select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'occurrence_id', m.occurrence_id, 'course_code', c.course_code,
               'starts_at', o.starts_at) order by m.created_at desc), '[]'::jsonb)
      from public.misses m
      join public.class_occurrences o on o.id = m.occurrence_id
      join public.classes c on c.id = o.class_id
      where m.user_id = uid and m.explanation is null and not m.excused),
    'feed', (
      select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'actor_id', e.actor_id, 'occurrence_id', e.occurrence_id,
               'type', e.type, 'ref_id', e.ref_id, 'payload', e.payload, 'created_at', e.created_at) order by e.created_at desc), '[]'::jsonb)
      from public.feed_events e where e.id = any (recent)),
    'reactions', (
      select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'feed_event_id', r.feed_event_id, 'user_id', r.user_id, 'emoji', r.emoji)), '[]'::jsonb)
      from public.reactions r where r.feed_event_id = any (recent)),
    'comments', (
      select coalesce(jsonb_agg(jsonb_build_object('id', cm.id, 'feed_event_id', cm.feed_event_id, 'user_id', cm.user_id,
               'username', p.username, 'display_name', p.display_name, 'text', cm.text, 'created_at', cm.created_at) order by cm.created_at), '[]'::jsonb)
      from public.comments cm join public.profiles p on p.id = cm.user_id where cm.feed_event_id = any (recent)),
    'groups', (
      select coalesce(jsonb_agg(public.group_json(g.id, today, week_start, t) order by g.created_at), '[]'::jsonb)
      from public.groups g where g.id in (select public.my_group_ids())),
    'shared_courses', (
      select coalesce(jsonb_agg(jsonb_build_object('course_code', x.course_code, 'name', x.name, 'user_ids', x.user_ids) order by x.course_code), '[]'::jsonb)
      from (
        select mc.course_code, min(mc.name) as name,
               (select jsonb_agg(distinct fc.user_id) from public.classes fc
                 where fc.user_id in (select public.friends_of(uid)) and fc.course_code = mc.course_code
                   and (fc.term_end is null or fc.term_end >= today)) as user_ids
        from public.classes mc
        where mc.user_id = uid and (mc.term_end is null or mc.term_end >= today)
        group by mc.course_code) x
      where x.user_ids is not null)
  );
end $$;

-- ---------------------------------------------------------------- grants

revoke execute on function
  public.my_group_ids(), public.group_mates(uuid), public.is_group_member(uuid, uuid), public.gen_invite_code(),
  public.miss_group_excused(uuid, uuid), public.void_forfeit(uuid, uuid), public.group_days(uuid),
  public.group_streak(uuid), public.group_best_streak(uuid), public.group_json(uuid, date, date, timestamptz),
  public.group_state(uuid), public.check_miss_in_group(uuid, uuid, uuid),
  public.create_group(text, text, text), public.join_group(text), public.add_to_group(uuid, uuid),
  public.leave_group(uuid), public.update_group(uuid, text, text, text), public.mark_forfeit_paid(uuid),
  public.vote_miss(uuid, uuid, boolean), public.vouch_miss(uuid, uuid)
from public, anon;

grant execute on function
  public.create_group(text, text, text), public.join_group(text), public.add_to_group(uuid, uuid),
  public.leave_group(uuid), public.update_group(uuid, text, text, text), public.mark_forfeit_paid(uuid),
  public.vote_miss(uuid, uuid, boolean), public.vouch_miss(uuid, uuid), public.group_state(uuid),
  public.my_group_ids(), public.is_group_member(uuid, uuid), public.miss_group_excused(uuid, uuid)
to authenticated, service_role;

grant execute on function
  public.group_mates(uuid), public.gen_invite_code(), public.void_forfeit(uuid, uuid), public.group_days(uuid),
  public.group_streak(uuid), public.group_best_streak(uuid), public.group_json(uuid, date, date, timestamptz),
  public.check_miss_in_group(uuid, uuid, uuid)
to service_role;
