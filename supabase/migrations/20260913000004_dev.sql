-- Present v2 — dev / demo controls
-- Scope = the caller and their accepted friends. DELETE THIS FILE before any real release.

create or replace function public.dev_scope() returns setof uuid
language sql stable security definer set search_path = public as $$ select public.visible_users() $$;

create or replace function public.dev_reset_demo() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  -- cascades: posts, misses, feed_events -> reactions, comments
  delete from public.class_occurrences where is_demo and user_id in (select public.dev_scope());
  get diagnostics n = row_count;
  return n;
end $$;

-- Inserts an is_demo occurrence starting now for everyone in scope who has p_course. The window
-- is p_on_time_min of on-time posting, then p_late_min of late posting, then a miss.
create or replace function public.dev_start_class_now(p_course text, p_on_time_min int default 2, p_late_min int default 2)
returns int
language plpgsql security definer set search_path = public as $$
declare n int; t timestamptz := public.app_now();
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  perform public.dev_reset_demo();
  insert into public.class_occurrences
    (class_id, user_id, date, starts_at, ends_at, opens_at, on_time_until, deadline, is_demo)
  select c.id, c.user_id, public.my_today(), t,
         t + make_interval(mins => p_on_time_min + p_late_min),
         t - interval '1 min',
         t + make_interval(mins => p_on_time_min),
         t + make_interval(mins => p_on_time_min + p_late_min),
         true
  from public.classes c
  where c.user_id in (select public.dev_scope()) and c.course_code = p_course;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'Nobody has a class with code %', p_course; end if;
  return n;
end $$;

-- The next post from a pending demo occurrence is late.
create or replace function public.dev_end_on_time_now() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  update public.class_occurrences set on_time_until = public.app_now() - interval '1 second'
   where is_demo and status = 'pending' and user_id in (select public.dev_scope());
  get diagnostics n = row_count;
  return n;
end $$;

-- Every pending demo occurrence becomes a miss right now.
create or replace function public.dev_end_window_now() returns int
language plpgsql security definer set search_path = public as $$
declare t timestamptz := public.app_now();
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  update public.class_occurrences set deadline = t, on_time_until = least(on_time_until, t), ends_at = least(ends_at, t)
   where is_demo and status = 'pending' and user_id in (select public.dev_scope());
  return public.detect_misses();
end $$;

-- Pins the classes behind the pending demo occurrences to here (300 m), so the presenter's
-- next post shows "Nearby" wherever the demo happens.
create or replace function public.dev_pin_here(p_lat double precision, p_lng double precision) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  update public.classes set lat = p_lat, lng = p_lng, radius_m = 300
   where id in (select class_id from public.class_occurrences
                where is_demo and status = 'pending' and user_id in (select public.dev_scope()));
  get diagnostics n = row_count;
  return n;
end $$;

-- Server-side stand-in for a friend whose phone died: posts for them with a seed photo.
create or replace function public.dev_replay_post(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare occ uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if not (p_user in (select public.dev_scope())) then raise exception 'That person is not a friend'; end if;
  select id into occ from public.class_occurrences
   where is_demo and status = 'pending' and user_id = p_user
   order by created_at desc limit 1;
  if occ is null then raise exception 'No pending demo class for that person'; end if;
  return public.create_post_for(p_user, occ, 'seed/' || p_user::text || '/1.jpg', null, null, 0, null, null, null);
end $$;

create or replace function public.dev_replay_explanation(p_text text) returns void
language plpgsql security definer set search_path = public as $$
declare mid uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select m.id into mid from public.misses m
    join public.class_occurrences o on o.id = m.occurrence_id
   where o.is_demo and m.explanation is null and not m.excused and m.user_id in (select public.dev_scope())
   order by m.created_at desc limit 1;
  if mid is null then raise exception 'No unexplained demo miss'; end if;
  update public.misses set explanation = left(trim(p_text), 140) where id = mid;
end $$;

revoke execute on function
  public.dev_scope(), public.dev_reset_demo(), public.dev_start_class_now(text, int, int), public.dev_end_on_time_now(),
  public.dev_end_window_now(), public.dev_pin_here(double precision, double precision), public.dev_replay_post(uuid),
  public.dev_replay_explanation(text)
from public, anon;

grant execute on function
  public.dev_scope(), public.dev_reset_demo(), public.dev_start_class_now(text, int, int), public.dev_end_on_time_now(),
  public.dev_end_window_now(), public.dev_pin_here(double precision, double precision), public.dev_replay_post(uuid),
  public.dev_replay_explanation(text)
to authenticated, service_role;
