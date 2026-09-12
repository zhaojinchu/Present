-- Present v2 — functions, triggers, RPCs
-- Every function is security definer with a pinned search_path, and every RPC re-checks
-- auth.uid(). Clients never insert into posts, misses, feed_events or class_occurrences.

-- ---------------------------------------------------------------- helpers

create or replace function public.local_today(p_tz text) returns date
language sql stable as $$ select (public.app_now() at time zone p_tz)::date $$;

create or replace function public.my_tz() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select tz from public.profiles where id = auth.uid()), 'UTC')
$$;

create or replace function public.my_today() returns date
language sql stable security definer set search_path = public as $$
  select public.local_today(public.my_tz())
$$;

create or replace function public.friends_of(p_user uuid) returns setof uuid
language sql stable security definer set search_path = public as $$
  select case when f.user_lo = p_user then f.user_hi else f.user_lo end
  from public.friendships f
  where f.status = 'accepted' and p_user in (f.user_lo, f.user_hi)
$$;

-- Me plus my accepted friends. Every "who can see what" rule reduces to this.
create or replace function public.visible_users() returns setof uuid
language sql stable security definer set search_path = public as $$
  select auth.uid() union select public.friends_of(auth.uid())
$$;

create or replace function public.event_visible(p_event uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.feed_events e
    where e.id = p_event and e.actor_id in (select public.visible_users()))
$$;

create or replace function public.haversine_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)))
$$;

create or replace function public.profile_json(p public.profiles) returns jsonb
language sql immutable as $$
  select jsonb_build_object('display_name', p.display_name, 'username', p.username, 'avatar_url', p.avatar_url)
$$;

-- ---------------------------------------------------------------- occurrences

-- Creates occurrences for a date range, idempotently, in each class's own time zone, inside the
-- term and outside the exception dates. Never creates one whose deadline already passed, so
-- importing a 9:30 class at 3pm cannot produce an instant miss.
create or replace function public.ensure_occurrences(p_from date, p_days int default 1, p_class uuid default null, p_user uuid default null)
returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.class_occurrences
    (class_id, user_id, date, starts_at, ends_at, opens_at, on_time_until, deadline)
  select c.id, c.user_id, d::date, t.s, t.e,
         t.s - interval '2 min', t.s + interval '10 min', t.e + interval '10 min'
  from public.classes c
  cross join generate_series(p_from::timestamp, (p_from + (p_days - 1))::timestamp, interval '1 day') as d
  cross join lateral (
    select (d::date + c.start_time) at time zone c.tz as s,
           (d::date + c.end_time)   at time zone c.tz as e) t
  where extract(dow from d)::smallint = any (c.days_of_week)
    and (p_class is null or c.id = p_class)
    and (p_user is null or c.user_id = p_user)
    and (c.term_start is null or d::date >= c.term_start)
    and (c.term_end is null or d::date <= c.term_end)
    and not (d::date = any (c.exdates))
    and t.e + interval '10 min' > public.app_now()
  on conflict (class_id, date) where not is_demo do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- Client-facing wrapper: yesterday, today and tomorrow for my own classes (covers every zone).
create or replace function public.ensure_my_occurrences() returns int
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  return public.ensure_occurrences(public.my_today() - 1, 3, null, auth.uid());
end $$;

create or replace function public.on_class_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    -- Only a schedule change touches occurrences; pinning the room does not.
    if (old.days_of_week, old.start_time, old.end_time, old.tz, old.term_start, old.term_end, old.exdates)
       is not distinct from (new.days_of_week, new.start_time, new.end_time, new.tz, new.term_start, new.term_end, new.exdates) then
      return new;
    end if;
    delete from public.class_occurrences
     where class_id = new.id and status = 'pending' and not is_demo and opens_at > public.app_now();
  end if;
  perform public.ensure_occurrences(public.local_today(new.tz), 7, new.id);
  return new;
end $$;

create trigger classes_after_change
  after insert or update on public.classes
  for each row execute function public.on_class_change();

-- ---------------------------------------------------------------- streaks (computed on read)

-- A local class-day is broken if any occurrence was missed, complete if every occurrence was posted
-- on time or excused, and ignored otherwise (pending, or only late posts). Streak = consecutive
-- complete days back from the most recent decided day.
create or replace function public.personal_streak(p_user uuid) returns int
language sql stable security definer set search_path = public as $$
  with days as (
    select o.date as d,
           bool_or(o.status = 'missed') as broken,
           bool_and(o.status = 'excused' or (o.status = 'posted' and not o.late)) as complete
    from public.class_occurrences o
    where o.user_id = p_user
    group by 1
  ), decided as (
    select broken, row_number() over (order by d desc) as rn
    from days where broken or complete
  )
  select count(*)::int from decided
  where rn < coalesce((select min(rn) from decided where broken), 2147483647);
$$;

create or replace function public.best_streak(p_user uuid) returns int
language sql stable security definer set search_path = public as $$
  with days as (
    select o.date as d,
           bool_or(o.status = 'missed') as broken,
           bool_and(o.status = 'excused' or (o.status = 'posted' and not o.late)) as complete
    from public.class_occurrences o
    where o.user_id = p_user
    group by 1
  ), decided as (
    select d, broken from days where broken or complete
  ), runs as (
    select broken, sum(case when broken then 1 else 0 end) over (order by d) as grp from decided
  )
  select coalesce(max(cnt), 0)::int
  from (select grp, count(*) filter (where not broken) as cnt from runs group by grp) x;
$$;

-- ---------------------------------------------------------------- posting

-- The only way a post is created. Enforces the window, decides on time vs late, handles the
-- pinned room and the "Nearby" flag, flips the occurrence, and writes the feed event.
create or replace function public.create_post_for(
  p_user uuid, p_occurrence_id uuid, p_photo_path text, p_photo_back_path text, p_caption text,
  p_retake_count int, p_lat double precision, p_lng double precision, p_accuracy double precision)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  o public.class_occurrences; c public.classes; p public.profiles;
  t timestamptz := public.app_now(); is_late boolean; verified boolean := false;
  r int; post_id uuid; streak int;
begin
  if p_user is null then raise exception 'Not signed in'; end if;
  select * into o from public.class_occurrences where id = p_occurrence_id for update;
  if o.id is null then raise exception 'That class does not exist'; end if;
  if o.user_id <> p_user then raise exception 'That is not your class'; end if;
  if o.status = 'posted' then raise exception 'You already posted for this class'; end if;
  if o.status <> 'pending' then raise exception 'This class is already %', o.status; end if;
  if t < o.opens_at then raise exception 'Not yet. Posting opens 2 minutes before class'; end if;
  if t > o.deadline then raise exception 'Too late. This class is already missed'; end if;
  if coalesce(trim(p_photo_path), '') = '' then raise exception 'A photo is required'; end if;

  is_late := t > o.on_time_until;
  select * into c from public.classes where id = o.class_id;

  if p_lat is not null and p_lng is not null then
    r := greatest(40, ceil(1.5 * coalesce(p_accuracy, 50)))::int;
    if c.lat is null or c.lng is null then
      if not is_late then
        update public.classes set lat = p_lat, lng = p_lng, radius_m = r where id = c.id;
        verified := true;
      end if;
    else
      verified := public.haversine_m(p_lat, p_lng, c.lat, c.lng) <= greatest(coalesce(c.radius_m, 40), r);
    end if;
  end if;

  insert into public.posts
    (occurrence_id, user_id, photo_path, photo_back_path, caption, late, location_verified, retake_count, expires_at, memory_until, created_at)
  values
    (o.id, p_user, trim(p_photo_path), nullif(trim(coalesce(p_photo_back_path, '')), ''),
     nullif(left(trim(coalesce(p_caption, '')), 140), ''), is_late, verified,
     greatest(0, coalesce(p_retake_count, 0)), t + interval '24 hours', t + interval '30 days', t)
  returning id into post_id;

  update public.class_occurrences set status = 'posted', late = is_late, posted_at = t where id = o.id;

  select * into p from public.profiles where id = p_user;
  streak := public.personal_streak(p_user);

  insert into public.feed_events (actor_id, occurrence_id, type, ref_id, payload, created_at)
  values (p_user, o.id, 'post', post_id, public.profile_json(p) || jsonb_build_object(
    'course_code', c.course_code, 'location_text', c.location_text, 'starts_at', o.starts_at, 'posted_at', t,
    'photo_path', trim(p_photo_path), 'photo_back_path', nullif(trim(coalesce(p_photo_back_path, '')), ''),
    'caption', nullif(left(trim(coalesce(p_caption, '')), 140), ''), 'late', is_late,
    'location_verified', verified, 'retake_count', greatest(0, coalesce(p_retake_count, 0)),
    'expires_at', t + interval '24 hours', 'streak_after', streak), t);

  return jsonb_build_object('post_id', post_id, 'late', is_late, 'location_verified', verified, 'streak_after', streak);
end $$;

create or replace function public.create_post(
  p_occurrence_id uuid, p_photo_path text, p_photo_back_path text default null, p_caption text default null,
  p_retake_count int default 0, p_lat double precision default null, p_lng double precision default null,
  p_accuracy double precision default null)
returns jsonb
language sql security definer set search_path = public as $$
  select public.create_post_for(auth.uid(), p_occurrence_id, p_photo_path, p_photo_back_path, p_caption, p_retake_count, p_lat, p_lng, p_accuracy)
$$;

-- ---------------------------------------------------------------- miss detection

-- Idempotent: only pending rows past their deadline, locked, flipped in the same transaction. Safe
-- to call from cron, every client and the dev button at once. streak_before is memoized per user.
create or replace function public.detect_misses() returns int
language plpgsql security definer set search_path = public as $$
declare
  o record; m_id uuid; n int := 0; p public.profiles; before int;
  memo jsonb := '{}'::jsonb; t timestamptz := public.app_now();
begin
  for o in
    select occ.id, occ.user_id, occ.starts_at, cl.course_code
    from public.class_occurrences occ
    join public.classes cl on cl.id = occ.class_id
    where occ.status = 'pending' and occ.deadline <= t
    for update of occ skip locked
  loop
    if not (memo ? o.user_id::text) then
      memo := memo || jsonb_build_object(o.user_id::text, public.personal_streak(o.user_id));
    end if;
    before := (memo ->> o.user_id::text)::int;
    select * into p from public.profiles where id = o.user_id;

    update public.class_occurrences set status = 'missed' where id = o.id;
    insert into public.misses (occurrence_id, user_id, created_at) values (o.id, o.user_id, t) returning id into m_id;
    insert into public.feed_events (actor_id, occurrence_id, type, ref_id, payload, created_at)
    values (o.user_id, o.id, 'miss', m_id, public.profile_json(p) || jsonb_build_object(
      'course_code', o.course_code, 'starts_at', o.starts_at, 'streak_before', before), t);
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------- misses: explanation / excuse

-- The explanation becomes the author's first comment under the miss; an excuse flips the
-- occurrence to excused (streak-neutral) and posts an excused event.
create or replace function public.on_miss_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare ev uuid; p public.profiles; cc text; t timestamptz := public.app_now();
begin
  select id into ev from public.feed_events where type = 'miss' and ref_id = new.id limit 1;

  if new.explanation is distinct from old.explanation and new.explanation is not null and ev is not null then
    insert into public.comments (feed_event_id, user_id, text, created_at) values (ev, new.user_id, new.explanation, t);
  end if;

  if new.excused and not old.excused then
    update public.class_occurrences set status = 'excused' where id = new.occurrence_id and status = 'missed';
    select * into p from public.profiles where id = new.user_id;
    select c.course_code into cc from public.class_occurrences o join public.classes c on c.id = o.class_id where o.id = new.occurrence_id;
    insert into public.feed_events (actor_id, occurrence_id, type, ref_id, payload, created_at)
    values (new.user_id, new.occurrence_id, 'excused', new.id,
            public.profile_json(p) || jsonb_build_object('course_code', cc, 'pre_emptive', false), t);
  end if;
  return new;
end $$;

create trigger misses_after_update
  after update on public.misses
  for each row execute function public.on_miss_update();

create or replace function public.explain_miss(p_miss_id uuid, p_text text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if length(trim(coalesce(p_text, ''))) = 0 then raise exception 'Say something'; end if;
  update public.misses set explanation = left(trim(p_text), 140)
   where id = p_miss_id and user_id = auth.uid();
  if not found then raise exception 'Miss not found'; end if;
end $$;

create or replace function public.excuse_miss(p_miss_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.misses set excused = true
   where id = p_miss_id and user_id = auth.uid() and not excused;
  if not found then raise exception 'Miss not found or already excused'; end if;
end $$;

-- Pre-emptive excuse ("Can't make it"), before the deadline.
create or replace function public.excuse_occurrence(p_occurrence_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o public.class_occurrences; uid uuid := auth.uid(); p public.profiles; cc text; m_id uuid; t timestamptz := public.app_now();
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select * into o from public.class_occurrences where id = p_occurrence_id for update;
  if o.id is null or o.user_id <> uid then raise exception 'That is not your class'; end if;
  if o.status <> 'pending' then raise exception 'This class is already %', o.status; end if;

  update public.class_occurrences set status = 'excused' where id = o.id;
  insert into public.misses (occurrence_id, user_id, excused, created_at) values (o.id, uid, true, t) returning id into m_id;
  select * into p from public.profiles where id = uid;
  select course_code into cc from public.classes where id = o.class_id;
  insert into public.feed_events (actor_id, occurrence_id, type, ref_id, payload, created_at)
  values (uid, o.id, 'excused', m_id, public.profile_json(p) || jsonb_build_object('course_code', cc, 'pre_emptive', true), t);
end $$;

-- ---------------------------------------------------------------- friends

create or replace function public.username_available(p_username text) returns boolean
language sql stable security definer set search_path = public as $$
  select lower(trim(coalesce(p_username, ''))) ~ '^[a-z0-9_]{3,20}$'
     and not exists (select 1 from public.profiles where username = lower(trim(p_username)) and id is distinct from auth.uid())
$$;

-- Returns the resulting relation: 'outgoing' (request sent or already pending), or 'friends'
-- (already friends, or they had asked me and this accepted it).
create or replace function public.send_friend_request(p_username text) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); target uuid; lo uuid; hi uuid; f public.friendships; me public.profiles; them public.profiles; t timestamptz := public.app_now();
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select id into target from public.profiles where username = lower(trim(coalesce(p_username, '')));
  if target is null then raise exception 'No one with that username'; end if;
  if target = uid then raise exception 'That is you'; end if;
  lo := least(uid, target); hi := greatest(uid, target);
  select * into f from public.friendships where user_lo = lo and user_hi = hi for update;
  if f.user_lo is null then
    insert into public.friendships (user_lo, user_hi, requested_by, created_at) values (lo, hi, uid, t);
    return 'outgoing';
  end if;
  if f.status = 'accepted' then return 'friends'; end if;
  if f.requested_by = uid then return 'outgoing'; end if;
  -- They asked first: this accepts.
  update public.friendships set status = 'accepted', accepted_at = t where user_lo = lo and user_hi = hi;
  select * into me from public.profiles where id = uid;
  select * into them from public.profiles where id = target;
  insert into public.feed_events (actor_id, type, ref_id, payload, created_at)
  values (uid, 'friends', target, public.profile_json(me) || jsonb_build_object('friend_id', target, 'friend_name', them.display_name, 'friend_username', them.username), t);
  return 'friends';
end $$;

create or replace function public.accept_friend_request(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); lo uuid; hi uuid; me public.profiles; them public.profiles; t timestamptz := public.app_now();
begin
  if uid is null then raise exception 'Not signed in'; end if;
  lo := least(uid, p_user); hi := greatest(uid, p_user);
  update public.friendships set status = 'accepted', accepted_at = t
   where user_lo = lo and user_hi = hi and status = 'pending' and requested_by = p_user;
  if not found then raise exception 'No request from that person'; end if;
  select * into me from public.profiles where id = uid;
  select * into them from public.profiles where id = p_user;
  insert into public.feed_events (actor_id, type, ref_id, payload, created_at)
  values (uid, 'friends', p_user, public.profile_json(me) || jsonb_build_object('friend_id', p_user, 'friend_name', them.display_name, 'friend_username', them.username), t);
end $$;

-- Decline, cancel or unfriend: all the same delete.
create or replace function public.remove_friend(p_user uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not signed in'; end if;
  delete from public.friendships where user_lo = least(uid, p_user) and user_hi = greatest(uid, p_user);
  return found;
end $$;

create or replace function public.search_users(p_query text) returns jsonb
language sql stable security definer set search_path = public as $$
  with q as (select lower(trim(coalesce(p_query, ''))) as s)
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'username', p.username, 'display_name', p.display_name, 'avatar_url', p.avatar_url,
           'relation', case
             when f.status = 'accepted' then 'friends'
             when f.status = 'pending' and f.requested_by = auth.uid() then 'outgoing'
             when f.status = 'pending' then 'incoming'
             else 'none' end) order by (p.username = (select s from q)) desc, p.username), '[]'::jsonb)
  from (
    select * from public.profiles p
    where p.id <> auth.uid() and length((select s from q)) >= 1
      and (p.username like (select s from q) || '%' or lower(p.display_name) like '%' || (select s from q) || '%')
    order by (p.username = (select s from q)) desc, p.username
    limit 10) p
  left join public.friendships f
    on f.user_lo = least(auth.uid(), p.id) and f.user_hi = greatest(auth.uid(), p.id)
$$;

-- ---------------------------------------------------------------- profile

create or replace function public.update_profile(p_display_name text default null, p_username text default null, p_avatar_url text default null, p_tz text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); p public.profiles;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if p_username is not null and lower(trim(p_username)) !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'Usernames are 3 to 20 letters, numbers or underscores';
  end if;
  if p_tz is not null and not public.valid_tz(p_tz) then raise exception 'Unknown time zone'; end if;
  begin
    update public.profiles set
      display_name = coalesce(nullif(left(trim(p_display_name), 60), ''), display_name),
      username     = coalesce(lower(trim(p_username)), username),
      avatar_url   = coalesce(p_avatar_url, avatar_url),
      tz           = coalesce(p_tz, tz)
    where id = uid returning * into p;
  exception when unique_violation then
    raise exception 'That username is taken';
  end;
  return to_jsonb(p);
end $$;

-- ---------------------------------------------------------------- reactions and comments

create or replace function public.toggle_reaction(p_event_id uuid, p_emoji text) returns boolean
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if not public.event_visible(p_event_id) then raise exception 'You cannot see that post'; end if;
  if p_emoji is null or length(p_emoji) = 0 or length(p_emoji) > 8 then raise exception 'Bad emoji'; end if;
  delete from public.reactions where feed_event_id = p_event_id and user_id = uid and emoji = p_emoji;
  if found then return false; end if;
  insert into public.reactions (feed_event_id, user_id, emoji) values (p_event_id, uid, p_emoji);
  return true;
end $$;

create or replace function public.add_comment(p_event_id uuid, p_text text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c public.comments; p public.profiles;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if not public.event_visible(p_event_id) then raise exception 'You cannot see that post'; end if;
  if length(trim(coalesce(p_text, ''))) = 0 then raise exception 'Say something'; end if;
  insert into public.comments (feed_event_id, user_id, text) values (p_event_id, uid, left(trim(p_text), 200)) returning * into c;
  select * into p from public.profiles where id = uid;
  return jsonb_build_object('id', c.id, 'feed_event_id', c.feed_event_id, 'user_id', c.user_id,
    'username', p.username, 'display_name', p.display_name, 'text', c.text, 'created_at', c.created_at);
end $$;

-- ---------------------------------------------------------------- schedule import

-- Upserts calendar-derived classes by (user, ics_uid). Unchanged rows are left alone so the
-- occurrence trigger does not fire. With p_replace, ics classes absent from the payload are
-- retired (term ended yesterday) rather than deleted, so history survives.
create or replace function public.import_classes(p_classes jsonb, p_replace boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); item jsonb; existing public.classes;
  v_uid text; v_code text; v_name text; v_loc text; v_tz text; v_days smallint[];
  v_start time; v_end time; v_ts date; v_te date; v_ex date[];
  seen text[] := '{}'; ins int := 0; upd int := 0; unch int := 0; ret int := 0; today date;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if p_classes is null or jsonb_typeof(p_classes) <> 'array' then raise exception 'Expected a list of classes'; end if;
  today := public.my_today();

  for item in select * from jsonb_array_elements(p_classes) loop
    v_uid   := nullif(trim(coalesce(item ->> 'ics_uid', '')), '');
    v_code  := left(trim(coalesce(item ->> 'course_code', '')), 32);
    v_name  := nullif(left(trim(coalesce(item ->> 'name', '')), 120), '');
    v_loc   := nullif(left(trim(coalesce(item ->> 'location_text', '')), 120), '');
    v_tz    := nullif(trim(coalesce(item ->> 'tz', '')), '');
    if v_tz is null or not public.valid_tz(v_tz) then v_tz := public.my_tz(); end if;
    select coalesce(array_agg(x::smallint order by x::smallint), '{}') into v_days
      from jsonb_array_elements_text(coalesce(item -> 'days_of_week', '[]'::jsonb)) x;
    v_start := (item ->> 'start_time')::time;
    v_end   := (item ->> 'end_time')::time;
    v_ts    := (item ->> 'term_start')::date;
    v_te    := (item ->> 'term_end')::date;
    select coalesce(array_agg(x::date), '{}') into v_ex
      from jsonb_array_elements_text(coalesce(item -> 'exdates', '[]'::jsonb)) x;
    if v_code = '' then raise exception 'A course code is required'; end if;
    if cardinality(v_days) = 0 then raise exception '% has no days', v_code; end if;
    if v_end <= v_start then raise exception '% ends before it starts', v_code; end if;

    if v_uid is null then
      insert into public.classes (user_id, course_code, name, location_text, tz, days_of_week, start_time, end_time, term_start, term_end, exdates, source)
      values (uid, v_code, v_name, v_loc, v_tz, v_days, v_start, v_end, v_ts, v_te, v_ex, 'manual');
      ins := ins + 1;
      continue;
    end if;

    seen := seen || v_uid;
    select * into existing from public.classes where user_id = uid and ics_uid = v_uid;
    if existing.id is null then
      insert into public.classes (user_id, course_code, name, location_text, tz, days_of_week, start_time, end_time, term_start, term_end, exdates, source, ics_uid)
      values (uid, v_code, v_name, v_loc, v_tz, v_days, v_start, v_end, v_ts, v_te, v_ex, 'ics', v_uid);
      ins := ins + 1;
    elsif (existing.course_code, existing.name, existing.location_text, existing.tz, existing.days_of_week,
           existing.start_time, existing.end_time, existing.term_start, existing.term_end, existing.exdates)
          is distinct from (v_code, v_name, v_loc, v_tz, v_days, v_start, v_end, v_ts, v_te, v_ex) then
      update public.classes set course_code = v_code, name = v_name, location_text = v_loc, tz = v_tz,
             days_of_week = v_days, start_time = v_start, end_time = v_end, term_start = v_ts, term_end = v_te, exdates = v_ex
       where id = existing.id;
      upd := upd + 1;
    else
      unch := unch + 1;
    end if;
  end loop;

  if p_replace then
    update public.classes set term_end = today - 1
     where user_id = uid and source = 'ics' and ics_uid is not null and not (ics_uid = any (seen))
       and (term_end is null or term_end >= today);
    get diagnostics ret = row_count;
  end if;

  return jsonb_build_object('inserted', ins, 'updated', upd, 'unchanged', unch, 'retired', ret,
    'class_count', (select count(*) from public.classes where user_id = uid and (term_end is null or term_end >= today)));
end $$;

-- ---------------------------------------------------------------- one-shot state for the client

create or replace function public.get_state() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); me public.profiles; today date; vis uuid[]; recent uuid[]; t timestamptz := public.app_now();
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select * into me from public.profiles where id = uid;
  if me.id is null then raise exception 'No profile'; end if;
  today := public.local_today(me.tz);
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
        from public.profiles p where p.id = any (vis) and p.id <> uid) s),
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
      from public.comments cm join public.profiles p on p.id = cm.user_id where cm.feed_event_id = any (recent))
  );
end $$;

-- My own posts still inside their memory window, newest first (the profile grid).
create or replace function public.get_memories() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', ps.id, 'occurrence_id', ps.occurrence_id, 'course_code', c.course_code, 'starts_at', o.starts_at,
           'photo_path', ps.photo_path, 'photo_back_path', ps.photo_back_path, 'caption', ps.caption, 'late', ps.late,
           'location_verified', ps.location_verified, 'created_at', ps.created_at) order by ps.created_at desc), '[]'::jsonb)
  from public.posts ps
  join public.class_occurrences o on o.id = ps.occurrence_id
  join public.classes c on c.id = o.class_id
  where ps.user_id = auth.uid() and ps.memory_until > public.app_now() and ps.photo_path is not null
$$;

-- Nulls photo paths once the author's memory window has passed (hourly cron).
create or replace function public.expire_photos() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.posts set photo_path = null, photo_back_path = null
   where memory_until < public.app_now() and photo_path is not null;
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------------------------------------------------------------- web push (stretch)

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  insert into public.push_subscriptions (endpoint, user_id, p256dh, auth) values (p_endpoint, auth.uid(), p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth;
end $$;

create or replace function public.remove_push_subscription(p_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid()
$$;

-- ---------------------------------------------------------------- grants

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
-- Internal only: no client may generate occurrences for others, post as someone else, or expire photos.
revoke execute on function
  public.ensure_occurrences(date, int, uuid, uuid),
  public.create_post_for(uuid, uuid, text, text, text, int, double precision, double precision, double precision),
  public.expire_photos()
from authenticated;
