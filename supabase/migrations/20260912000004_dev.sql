-- Present — dev / demo controls
-- Every function is scoped to the caller's circle. DELETE THIS FILE before any real release.

create or replace function public.dev_reset_demo() returns int
language plpgsql security definer set search_path = public as $$
declare cid uuid := public.my_circle_id(); n int;
begin
  if cid is null then raise exception 'Join a circle first'; end if;
  -- cascades: checkins, skips -> forfeits, feed_events -> reactions
  delete from public.class_occurrences
   where is_demo and user_id in (select user_id from public.circle_members where circle_id = cid);
  get diagnostics n = row_count;
  return n;
end $$;

-- Inserts an is_demo occurrence starting now for every circle member who has p_course.
create or replace function public.dev_start_class_now(p_course text, p_window_min int default 3, p_skip_after_min int default 3)
returns int
language plpgsql security definer set search_path = public as $$
declare cid uuid := public.my_circle_id(); n int; demo_exists boolean;
begin
  if cid is null then raise exception 'Join a circle first'; end if;
  perform public.dev_reset_demo();
  select exists (select 1 from public.buildings where code = 'DEMO') into demo_exists;

  insert into public.class_occurrences
    (class_id, user_id, building_code, date, starts_at, ends_at, window_start, window_end, skip_deadline, is_demo)
  select c.id, c.user_id,
         case when demo_exists then 'DEMO' else c.building_code end,
         public.ny_today(), now(), now() + make_interval(mins => p_skip_after_min),
         now() - interval '1 min', now() + make_interval(mins => p_window_min),
         now() + make_interval(mins => p_skip_after_min), true
  from public.classes c
  join public.circle_members m on m.user_id = c.user_id and m.circle_id = cid
  where c.course_code = p_course;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'Nobody in your circle has a class with code %', p_course; end if;
  return n;
end $$;

create or replace function public.dev_end_window_now() returns int
language plpgsql security definer set search_path = public as $$
declare cid uuid := public.my_circle_id();
begin
  if cid is null then raise exception 'Join a circle first'; end if;
  update public.class_occurrences
     set window_end = now(), skip_deadline = now()
   where is_demo and status = 'pending'
     and user_id in (select user_id from public.circle_members where circle_id = cid);
  return public.detect_skips();
end $$;

create or replace function public.dev_set_demo_building(p_lat double precision, p_lng double precision) returns void
language plpgsql security definer set search_path = public as $$
declare cid uuid := public.my_circle_id();
begin
  if cid is null then raise exception 'Join a circle first'; end if;
  insert into public.buildings (code, name, lat, lng, radius_m)
  values ('DEMO', 'Demo room', p_lat, p_lng, 300)
  on conflict (code) do update set lat = excluded.lat, lng = excluded.lng, radius_m = excluded.radius_m;
  update public.class_occurrences set building_code = 'DEMO'
   where is_demo and status = 'pending'
     and user_id in (select user_id from public.circle_members where circle_id = cid);
end $$;

-- Server-side stand-in for a teammate whose phone died: checks them in with a seed photo.
create or replace function public.dev_replay_checkin(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare cid uuid := public.my_circle_id(); occ uuid;
begin
  if cid is null then raise exception 'Join a circle first'; end if;
  if not exists (select 1 from public.circle_members where circle_id = cid and user_id = p_user) then
    raise exception 'That person is not in your circle';
  end if;
  select id into occ from public.class_occurrences
   where is_demo and status = 'pending' and user_id = p_user
   order by created_at desc limit 1;
  if occ is null then raise exception 'No pending demo class for that person'; end if;
  insert into public.checkins (occurrence_id, user_id, photo_path, in_geofence)
  values (occ, p_user, 'seed/' || p_user::text || '/1.jpg', true);
end $$;

create or replace function public.dev_replay_explanation(p_text text) returns void
language plpgsql security definer set search_path = public as $$
declare cid uuid := public.my_circle_id(); sid uuid;
begin
  if cid is null then raise exception 'Join a circle first'; end if;
  select s.id into sid from public.skips s
    join public.class_occurrences o on o.id = s.occurrence_id
   where s.circle_id = cid and o.is_demo and s.explanation is null and not s.excused
   order by s.created_at desc limit 1;
  if sid is null then raise exception 'No unexplained demo skip'; end if;
  update public.skips set explanation = left(trim(p_text), 140) where id = sid;
end $$;

create or replace function public.dev_replay_pay_forfeit() returns void
language plpgsql security definer set search_path = public as $$
declare cid uuid := public.my_circle_id(); f public.forfeits; payer uuid; owed_name text; payer_name text; occ uuid;
begin
  if cid is null then raise exception 'Join a circle first'; end if;
  select ff.* into f from public.forfeits ff
    join public.skips s on s.id = ff.skip_id
    join public.class_occurrences o on o.id = s.occurrence_id
   where ff.circle_id = cid and ff.status = 'owed' and o.is_demo
   order by ff.created_at desc limit 1;
  if f.id is null then raise exception 'No owed demo forfeit'; end if;
  select user_id into payer from public.circle_members
   where circle_id = cid and user_id <> f.owed_by
   order by (user_id = auth.uid()) desc limit 1;
  if payer is null then raise exception 'Nobody else in the circle can pay'; end if;

  update public.forfeits set status = 'paid', marked_paid_by = payer, paid_at = now() where id = f.id;
  select display_name into owed_name from public.profiles where id = f.owed_by;
  select display_name into payer_name from public.profiles where id = payer;
  select occurrence_id into occ from public.skips where id = f.skip_id;
  insert into public.feed_events (circle_id, actor_id, occurrence_id, type, ref_id, payload)
  values (f.circle_id, f.owed_by, occ, 'forfeit_paid', f.id, jsonb_build_object(
    'display_name', owed_name, 'paid_by_name', payer_name, 'paid_by', payer,
    'description', f.description, 'forfeit_id', f.id));
end $$;

revoke execute on function
  public.dev_reset_demo(), public.dev_start_class_now(text, int, int), public.dev_end_window_now(),
  public.dev_set_demo_building(double precision, double precision), public.dev_replay_checkin(uuid),
  public.dev_replay_explanation(text), public.dev_replay_pay_forfeit()
from public, anon;

grant execute on function
  public.dev_reset_demo(), public.dev_start_class_now(text, int, int), public.dev_end_window_now(),
  public.dev_set_demo_building(double precision, double precision), public.dev_replay_checkin(uuid),
  public.dev_replay_explanation(text), public.dev_replay_pay_forfeit()
to authenticated, service_role;
