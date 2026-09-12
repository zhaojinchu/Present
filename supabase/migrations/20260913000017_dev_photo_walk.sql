-- Present v2 — photo walk (dev). Open a window for the caller alone, right now, for a real room,
-- without the demo reset: a one-off manual class for today and a NON-demo occurrence, so
-- dev_reset_demo never removes the post or its photos, and nobody else gets a pending class.
-- The whole window counts as on time (p_minutes), then 5 late minutes. Dropped before any release.

create or replace function public.dev_photo_walk(p_course text, p_location text default null, p_minutes int default 10) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); t timestamptz := public.app_now(); z text; today date; cid uuid; oid uuid;
  mins int := greatest(3, least(120, coalesce(p_minutes, 10))); st time; et time;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if length(trim(coalesce(p_course, ''))) = 0 then raise exception 'Course code is required'; end if;
  select tz into z from public.profiles where id = uid;
  today := public.local_today(z);
  st := (t at time zone z)::time;
  et := ((t + make_interval(mins => mins)) at time zone z)::time;
  if et <= st then et := time '23:59:59'; end if;
  insert into public.classes (user_id, course_code, name, location_text, tz, days_of_week, start_time, end_time, term_start, term_end, source)
  values (uid, left(trim(p_course), 32), 'Photo walk', nullif(left(trim(coalesce(p_location, '')), 120), ''), z,
          array[extract(dow from today)::smallint], st, et, today, today, 'manual')
  returning id into cid;
  -- the class trigger generated today's occurrence from the wall-clock times; replace it with exact instants
  delete from public.class_occurrences where class_id = cid;
  insert into public.class_occurrences (class_id, user_id, date, starts_at, ends_at, opens_at, on_time_until, deadline, is_demo)
  values (cid, uid, today, t, t + make_interval(mins => mins), t - interval '1 min', t + make_interval(mins => mins), t + make_interval(mins => mins + 5), false)
  returning id into oid;
  return oid;
end $$;

revoke execute on function public.dev_photo_walk(text, text, int) from public, anon;
grant execute on function public.dev_photo_walk(text, text, int) to authenticated, service_role;
