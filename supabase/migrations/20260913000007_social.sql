-- Present v2 — social presence
-- Two feed event types that happen BEFORE a miss (heading out, nudge) and a weekly stats RPC.
-- Additive: nothing in 000001..000005 changes. All functions are plpgsql so the new enum values
-- are only resolved at call time (a sql-language body would try to resolve them at create time,
-- inside the same transaction that added them).
--
-- Payload contract additions (web/src/lib/types.ts mirrors these):
--   heading_out = profile_json(actor) + course_code, location_text, starts_at, ends_at, opens_at
--   nudge       = profile_json(actor) + target_id, target_username, target_name, target_avatar_url,
--                 course_code, starts_at, deadline

alter type public.feed_type add value if not exists 'heading_out';
alter type public.feed_type add value if not exists 'nudge';

-- ---------------------------------------------------------------- heading out

-- "Leaving now": one event per occurrence, allowed from 45 minutes before class until the deadline.
-- Friends see it in the feed and on their Today card for the same class. Calling it twice returns
-- the existing event instead of posting again.
create or replace function public.head_out(p_occurrence_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); o public.class_occurrences; c public.classes; p public.profiles;
  t timestamptz := public.app_now(); ev uuid;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select * into o from public.class_occurrences where id = p_occurrence_id;
  if o.id is null or o.user_id <> uid then raise exception 'That is not your class'; end if;
  if o.status <> 'pending' then raise exception 'This class is already %', o.status; end if;
  if t < o.starts_at - interval '45 minutes' then raise exception 'Too early. You can head out 45 minutes before class'; end if;
  if t > o.deadline then raise exception 'This class is over'; end if;

  select id into ev from public.feed_events
   where type = 'heading_out' and actor_id = uid and occurrence_id = o.id
   order by created_at desc limit 1;
  if ev is not null then return jsonb_build_object('event_id', ev, 'already', true); end if;

  select * into c from public.classes where id = o.class_id;
  select * into p from public.profiles where id = uid;
  insert into public.feed_events (actor_id, occurrence_id, type, ref_id, payload, created_at)
  values (uid, o.id, 'heading_out', null, public.profile_json(p) || jsonb_build_object(
    'course_code', c.course_code, 'location_text', c.location_text,
    'starts_at', o.starts_at, 'ends_at', o.ends_at, 'opens_at', o.opens_at), t)
  returning id into ev;
  return jsonb_build_object('event_id', ev, 'already', false);
end $$;

-- ---------------------------------------------------------------- nudge

-- Poke a friend whose class is about to start or is open and who has not posted. One nudge per
-- friend per occurrence, from 15 minutes before class until the deadline. The target sees a banner
-- (the client watches for nudge events with target_id = me); everyone sees the line in the feed.
create or replace function public.nudge(p_occurrence_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); o public.class_occurrences; c public.classes; me public.profiles; them public.profiles;
  t timestamptz := public.app_now(); ev uuid;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select * into o from public.class_occurrences where id = p_occurrence_id;
  if o.id is null then raise exception 'That class does not exist'; end if;
  if o.user_id = uid then raise exception 'You cannot nudge yourself'; end if;
  if not (o.user_id in (select public.visible_users())) then raise exception 'That person is not a friend'; end if;
  if o.status = 'posted' then raise exception 'They already posted'; end if;
  if o.status <> 'pending' then raise exception 'This class is already %', o.status; end if;
  if t < o.starts_at - interval '15 minutes' then raise exception 'Too early. You can nudge 15 minutes before class'; end if;
  if t > o.deadline then raise exception 'This class is over'; end if;
  if exists (select 1 from public.feed_events where type = 'nudge' and actor_id = uid and occurrence_id = o.id) then
    raise exception 'You already nudged them for this class';
  end if;

  select * into c from public.classes where id = o.class_id;
  select * into me from public.profiles where id = uid;
  select * into them from public.profiles where id = o.user_id;
  insert into public.feed_events (actor_id, occurrence_id, type, ref_id, payload, created_at)
  values (uid, o.id, 'nudge', o.user_id, public.profile_json(me) || jsonb_build_object(
    'target_id', them.id, 'target_username', them.username, 'target_name', them.display_name, 'target_avatar_url', them.avatar_url,
    'course_code', c.course_code, 'starts_at', o.starts_at, 'deadline', o.deadline), t)
  returning id into ev;
  return jsonb_build_object('event_id', ev);
end $$;

-- ---------------------------------------------------------------- stats

-- Attendance numbers for one person: this week (Monday to today, local) and the whole term.
-- "Decided" = posted, missed, excused, or pending with the deadline already passed.
create or replace function public.stats_for(p_user uuid, p_week_start date, p_today date, p_now timestamptz) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  select jsonb_build_object(
    'week_on_time',  count(*) filter (where o.date >= p_week_start and o.status = 'posted' and not o.late),
    'week_late',     count(*) filter (where o.date >= p_week_start and o.status = 'posted' and o.late),
    'week_missed',   count(*) filter (where o.date >= p_week_start and (o.status = 'missed' or (o.status = 'pending' and o.deadline <= p_now))),
    'week_excused',  count(*) filter (where o.date >= p_week_start and o.status = 'excused'),
    'week_total',    count(*) filter (where o.date >= p_week_start and (o.status <> 'pending' or o.deadline <= p_now)),
    'week_upcoming', count(*) filter (where o.date >= p_week_start and o.status = 'pending' and o.deadline > p_now),
    'term_on_time',  count(*) filter (where o.status = 'posted' and not o.late),
    'term_posted',   count(*) filter (where o.status = 'posted'),
    'term_missed',   count(*) filter (where o.status = 'missed' or (o.status = 'pending' and o.deadline <= p_now)),
    'term_total',    count(*) filter (where o.status <> 'pending' or o.deadline <= p_now),
    'minutes_in_class', coalesce(sum(extract(epoch from (o.ends_at - o.starts_at)) / 60) filter (where o.status = 'posted'), 0)::int,
    'best_streak',   public.best_streak(p_user)
  ) into r
  from public.class_occurrences o
  where o.user_id = p_user and o.date <= p_today;
  return r;
end $$;

-- Me plus every friend, so the You tab can show the week and a friends leaderboard from one call.
create or replace function public.get_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); me public.profiles; today date; week_start date; t timestamptz := public.app_now();
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select * into me from public.profiles where id = uid;
  if me.id is null then raise exception 'No profile'; end if;
  today := public.local_today(me.tz);
  week_start := today - (extract(isodow from today)::int - 1);
  return jsonb_build_object(
    'week_start', week_start,
    'today', today,
    'me', public.stats_for(uid, week_start, today, t) || jsonb_build_object('id', uid),
    'friends', (
      select coalesce(jsonb_agg(public.stats_for(p.id, week_start, today, t)
               || jsonb_build_object('id', p.id, 'username', p.username, 'display_name', p.display_name, 'avatar_url', p.avatar_url)), '[]'::jsonb)
      from public.profiles p where p.id in (select public.friends_of(uid)))
  );
end $$;

revoke execute on function public.head_out(uuid), public.nudge(uuid), public.get_stats(),
  public.stats_for(uuid, date, date, timestamptz) from public, anon;
grant execute on function public.head_out(uuid), public.nudge(uuid), public.get_stats() to authenticated, service_role;
grant execute on function public.stats_for(uuid, date, date, timestamptz) to service_role;
