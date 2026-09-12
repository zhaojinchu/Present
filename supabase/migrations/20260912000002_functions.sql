-- Present — functions, triggers, RPCs
-- All functions are security definer with a pinned search_path so client-triggered
-- writes to feed_events succeed under RLS. Every RPC re-checks the caller's rights.

-- ---------------------------------------------------------------- helpers

create or replace function public.ny_today() returns date
language sql stable as $$ select (now() at time zone 'America/New_York')::date $$;

create or replace function public.my_circle_id() returns uuid
language sql stable security definer set search_path = public as $$
  select circle_id from public.circle_members where user_id = auth.uid() limit 1
$$;

create or replace function public.same_circle(u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.circle_members a
    join public.circle_members b on b.circle_id = a.circle_id
    where a.user_id = auth.uid() and b.user_id = u)
$$;

-- ---------------------------------------------------------------- occurrences

-- Creates today's (or a range of) occurrences for every class, idempotently.
-- Never creates an occurrence whose skip deadline has already passed: adding a
-- 9:30 class at 3pm must not produce an instant skip.
create or replace function public.ensure_occurrences(p_from date, p_days int default 1, p_class uuid default null)
returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.class_occurrences
    (class_id, user_id, building_code, date, starts_at, ends_at, window_start, window_end, skip_deadline)
  select c.id, c.user_id, c.building_code, d::date,
         ((d::date + c.start_time) at time zone 'America/New_York'),
         ((d::date + c.end_time)   at time zone 'America/New_York'),
         ((d::date + c.start_time) at time zone 'America/New_York') - interval '10 min',
         ((d::date + c.start_time) at time zone 'America/New_York') + interval '15 min',
         ((d::date + c.end_time)   at time zone 'America/New_York') + interval '10 min'
  from public.classes c
  cross join generate_series(p_from::timestamp, (p_from + (p_days - 1))::timestamp, interval '1 day') as d
  where extract(dow from d)::smallint = any (c.days_of_week)
    and (p_class is null or c.id = p_class)
    and ((d::date + c.end_time) at time zone 'America/New_York') + interval '10 min' > now()
  on conflict (class_id, date) where not is_demo do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.on_class_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    delete from public.class_occurrences
     where class_id = new.id and status = 'pending' and not is_demo and window_start > now();
  end if;
  perform public.ensure_occurrences(public.ny_today(), 7, new.id);
  return new;
end $$;

create trigger classes_after_change
  after insert or update on public.classes
  for each row execute function public.on_class_change();

-- ---------------------------------------------------------------- streaks (computed on read)

-- A day is broken if any occurrence was skipped (unexcused), complete if every
-- occurrence is checked_in or excused, undecided (ignored) otherwise.
-- Streak = consecutive complete days back from the most recent decided day.
create or replace function public.personal_streak(p_user uuid) returns int
language sql stable security definer set search_path = public as $$
  with days as (
    select (starts_at at time zone 'America/New_York')::date as d,
           bool_or(status = 'skipped') as broken,
           bool_and(status in ('checked_in', 'excused')) as complete
    from public.class_occurrences
    where user_id = p_user
    group by 1
  ), decided as (
    select broken, row_number() over (order by d desc) as rn
    from days where broken or complete
  )
  select count(*)::int from decided
  where rn < coalesce((select min(rn) from decided where broken), 2147483647);
$$;

create or replace function public.circle_streak(p_circle uuid) returns int
language sql stable security definer set search_path = public as $$
  with days as (
    select (o.starts_at at time zone 'America/New_York')::date as d,
           bool_or(o.status = 'skipped') as broken,
           bool_and(o.status in ('checked_in', 'excused')) as complete
    from public.class_occurrences o
    join public.circle_members m on m.user_id = o.user_id and m.circle_id = p_circle
    where o.starts_at >= m.joined_at
    group by 1
  ), decided as (
    select broken, row_number() over (order by d desc) as rn
    from days where broken or complete
  )
  select count(*)::int from decided
  where rn < coalesce((select min(rn) from decided where broken), 2147483647);
$$;

-- ---------------------------------------------------------------- check-in

create or replace function public.on_checkin_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare o public.class_occurrences; cid uuid; cc text; nm text; av text;
begin
  select * into o from public.class_occurrences where id = new.occurrence_id for update;
  if o.id is null then raise exception 'That class does not exist'; end if;
  if o.user_id <> new.user_id then raise exception 'That is not your class'; end if;
  if o.status <> 'pending' then raise exception 'This class is already %', replace(o.status::text, '_', ' '); end if;
  if now() < o.window_start then raise exception 'The check-in window has not opened yet'; end if;
  if now() > o.window_end then raise exception 'The check-in window has closed'; end if;

  update public.class_occurrences set status = 'checked_in' where id = o.id;

  select circle_id into cid from public.circle_members where user_id = new.user_id limit 1;
  select course_code into cc from public.classes where id = o.class_id;
  select display_name, avatar_url into nm, av from public.profiles where id = new.user_id;

  if cid is not null then
    insert into public.feed_events (circle_id, actor_id, occurrence_id, type, ref_id, payload)
    values (cid, new.user_id, o.id, 'checkin', new.id, jsonb_build_object(
      'display_name', nm, 'avatar_url', av, 'course_code', cc,
      'photo_path', new.photo_path, 'photo_back_path', new.photo_back_path,
      'in_geofence', new.in_geofence,
      'personal_streak_after', public.personal_streak(new.user_id),
      'circle_streak_after', public.circle_streak(cid)));
  end if;
  return new;
end $$;

-- BEFORE insert so a second check-in gets "already checked in" instead of a unique-index error.
-- new.id already has its default by then, so the feed event can reference it.
create trigger checkins_before_insert
  before insert on public.checkins
  for each row execute function public.on_checkin_insert();

-- ---------------------------------------------------------------- skip detection

-- Idempotent: only pending rows past their deadline, locked, flipped in the same
-- transaction. Safe to call from cron, every client, and the dev button at once.
-- Streak "before" snapshots are memoized per user/circle so two members skipped
-- in one batch both render "8 -> 0".
create or replace function public.detect_skips() returns int
language plpgsql security definer set search_path = public as $$
declare
  o record; cid uuid; s_id uuid; f_id uuid; n int := 0;
  nm text; ftext text; p_before int; c_before int;
  p_memo jsonb := '{}'::jsonb; c_memo jsonb := '{}'::jsonb;
begin
  for o in
    select occ.id, occ.user_id, occ.starts_at, cl.course_code, cm.circle_id
    from public.class_occurrences occ
    join public.classes cl on cl.id = occ.class_id
    left join public.circle_members cm on cm.user_id = occ.user_id
    where occ.status = 'pending' and occ.skip_deadline <= now()
    for update of occ skip locked
  loop
    cid := o.circle_id;
    if cid is null then
      update public.class_occurrences set status = 'skipped' where id = o.id;
      continue;
    end if;

    if not (p_memo ? o.user_id::text) then
      p_memo := p_memo || jsonb_build_object(o.user_id::text, public.personal_streak(o.user_id));
    end if;
    if not (c_memo ? cid::text) then
      c_memo := c_memo || jsonb_build_object(cid::text, public.circle_streak(cid));
    end if;
    p_before := (p_memo ->> o.user_id::text)::int;
    c_before := (c_memo ->> cid::text)::int;
    select display_name into nm from public.profiles where id = o.user_id;
    select forfeit_text into ftext from public.circles where id = cid;

    update public.class_occurrences set status = 'skipped' where id = o.id;

    insert into public.skips (occurrence_id, user_id, circle_id)
    values (o.id, o.user_id, cid) returning id into s_id;

    insert into public.forfeits (circle_id, owed_by, skip_id, description, local_date)
    values (cid, o.user_id, s_id, ftext, (o.starts_at at time zone 'America/New_York')::date)
    on conflict (circle_id, owed_by, local_date) where status <> 'voided' do nothing
    returning id into f_id;

    insert into public.feed_events (circle_id, actor_id, occurrence_id, type, ref_id, payload)
    values (cid, o.user_id, o.id, 'skip', s_id, jsonb_build_object(
      'display_name', nm, 'course_code', o.course_code, 'starts_at', o.starts_at,
      'personal_streak_before', p_before, 'circle_streak_before', c_before));

    if f_id is not null then
      insert into public.feed_events (circle_id, actor_id, occurrence_id, type, ref_id, payload)
      values (cid, o.user_id, o.id, 'forfeit_owed', f_id, jsonb_build_object(
        'display_name', nm, 'description', ftext, 'forfeit_id', f_id));
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------- skips: explanation / after-the-fact excuse

create or replace function public.on_skip_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare nm text; cc text;
begin
  select display_name into nm from public.profiles where id = new.user_id;
  select c.course_code into cc
    from public.class_occurrences o join public.classes c on c.id = o.class_id
   where o.id = new.occurrence_id;

  if new.explanation is distinct from old.explanation and new.explanation is not null then
    insert into public.feed_events (circle_id, actor_id, occurrence_id, type, ref_id, payload)
    values (new.circle_id, new.user_id, new.occurrence_id, 'explanation', new.id,
            jsonb_build_object('display_name', nm, 'course_code', cc, 'text', new.explanation));
  end if;

  if new.excused and not old.excused then
    update public.class_occurrences set status = 'excused'
     where id = new.occurrence_id and status = 'skipped';
    update public.forfeits set status = 'voided'
     where skip_id = new.id and status = 'owed';
    insert into public.feed_events (circle_id, actor_id, occurrence_id, type, ref_id, payload)
    values (new.circle_id, new.user_id, new.occurrence_id, 'excused', new.id,
            jsonb_build_object('display_name', nm, 'course_code', cc, 'pre_emptive', false));
  end if;
  return new;
end $$;

create trigger skips_after_update
  after update on public.skips
  for each row execute function public.on_skip_update();

create or replace function public.explain_skip(p_skip_id uuid, p_text text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if length(trim(coalesce(p_text, ''))) = 0 then raise exception 'Say something'; end if;
  update public.skips set explanation = left(trim(p_text), 140)
   where id = p_skip_id and user_id = auth.uid();
  if not found then raise exception 'Skip not found'; end if;
end $$;

create or replace function public.excuse_skip(p_skip_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.skips set excused = true
   where id = p_skip_id and user_id = auth.uid() and not excused;
  if not found then raise exception 'Skip not found or already excused'; end if;
end $$;

-- Pre-emptive excuse from the Home screen, before the deadline.
create or replace function public.excuse_occurrence(p_occurrence_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o public.class_occurrences; uid uuid := auth.uid(); cid uuid := public.my_circle_id();
        nm text; cc text; s_id uuid;
begin
  if cid is null then raise exception 'Join a circle first'; end if;
  select * into o from public.class_occurrences where id = p_occurrence_id for update;
  if o.id is null or o.user_id <> uid then raise exception 'That is not your class'; end if;
  if o.status <> 'pending' then raise exception 'This class is already %', replace(o.status::text, '_', ' '); end if;

  update public.class_occurrences set status = 'excused' where id = o.id;
  insert into public.skips (occurrence_id, user_id, circle_id, excused)
  values (o.id, uid, cid, true) returning id into s_id;
  select display_name into nm from public.profiles where id = uid;
  select course_code into cc from public.classes where id = o.class_id;
  insert into public.feed_events (circle_id, actor_id, occurrence_id, type, ref_id, payload)
  values (cid, uid, o.id, 'excused', s_id,
          jsonb_build_object('display_name', nm, 'course_code', cc, 'pre_emptive', true));
end $$;

-- ---------------------------------------------------------------- forfeits

create or replace function public.mark_forfeit_paid(p_forfeit_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare f public.forfeits; uid uuid := auth.uid(); owed_name text; payer_name text; occ uuid;
begin
  select * into f from public.forfeits where id = p_forfeit_id for update;
  if f.id is null then raise exception 'Forfeit not found'; end if;
  if f.circle_id is distinct from public.my_circle_id() then raise exception 'That is not your circle'; end if;
  if f.owed_by = uid then raise exception 'You can''t clear your own forfeit. Someone else in the circle has to.'; end if;
  if f.status <> 'owed' then raise exception 'This forfeit is already %', f.status; end if;

  update public.forfeits set status = 'paid', marked_paid_by = uid, paid_at = now() where id = f.id;
  select display_name into owed_name from public.profiles where id = f.owed_by;
  select display_name into payer_name from public.profiles where id = uid;
  select occurrence_id into occ from public.skips where id = f.skip_id;
  insert into public.feed_events (circle_id, actor_id, occurrence_id, type, ref_id, payload)
  values (f.circle_id, f.owed_by, occ, 'forfeit_paid', f.id, jsonb_build_object(
    'display_name', owed_name, 'paid_by_name', payer_name, 'paid_by', uid,
    'description', f.description, 'forfeit_id', f.id));
end $$;

-- ---------------------------------------------------------------- circles

create or replace function public.create_circle(p_name text, p_forfeit_text text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); code text; c public.circles; nm text; i int; tries int := 0;
        alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if public.my_circle_id() is not null then raise exception 'You''re already in a circle'; end if;
  if length(trim(coalesce(p_name, ''))) = 0 then raise exception 'Give your circle a name'; end if;
  if length(trim(coalesce(p_forfeit_text, ''))) = 0 then raise exception 'Pick a forfeit'; end if;

  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.circles where invite_code = code);
    tries := tries + 1;
    if tries > 20 then raise exception 'Could not generate an invite code'; end if;
  end loop;

  insert into public.circles (name, forfeit_text, invite_code, created_by)
  values (trim(p_name), left(trim(p_forfeit_text), 80), code, uid) returning * into c;
  insert into public.circle_members (circle_id, user_id) values (c.id, uid);
  select display_name into nm from public.profiles where id = uid;
  insert into public.feed_events (circle_id, actor_id, type, payload)
  values (c.id, uid, 'member_joined', jsonb_build_object('display_name', nm, 'created', true));
  return to_jsonb(c);
end $$;

create or replace function public.join_circle(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c public.circles; nm text; cnt int;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if public.my_circle_id() is not null then raise exception 'You''re already in a circle'; end if;
  select * into c from public.circles where invite_code = upper(trim(coalesce(p_code, '')));
  if c.id is null then raise exception 'No circle with that code'; end if;
  select count(*) into cnt from public.circle_members where circle_id = c.id;
  if cnt >= 8 then raise exception 'That circle is full'; end if;

  insert into public.circle_members (circle_id, user_id) values (c.id, uid);
  select display_name into nm from public.profiles where id = uid;
  insert into public.feed_events (circle_id, actor_id, type, payload)
  values (c.id, uid, 'member_joined', jsonb_build_object('display_name', nm, 'created', false));
  return to_jsonb(c);
end $$;

-- ---------------------------------------------------------------- reactions

create or replace function public.toggle_reaction(p_event_id uuid, p_emoji text) returns boolean
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid;
begin
  select circle_id into cid from public.feed_events where id = p_event_id;
  if cid is null or cid is distinct from public.my_circle_id() then raise exception 'That is not your circle'; end if;
  delete from public.reactions where feed_event_id = p_event_id and user_id = uid and emoji = p_emoji;
  if found then return false; end if;
  insert into public.reactions (feed_event_id, circle_id, user_id, emoji) values (p_event_id, cid, uid, p_emoji);
  return true;
end $$;

-- ---------------------------------------------------------------- one-shot state for the client

create or replace function public.get_circle_state() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cid uuid := public.my_circle_id();
  today date := public.ny_today();
  recent_ids uuid[];
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if cid is null then
    return jsonb_build_object('circle', null, 'me', uid, 'server_time', now(),
      'my_class_count', (select count(*) from public.classes where user_id = uid));
  end if;

  select coalesce(array_agg(r.id), '{}'::uuid[]) into recent_ids
    from (select id from public.feed_events where circle_id = cid order by created_at desc limit 50) r;

  return jsonb_build_object(
    'me', uid,
    'server_time', now(),
    'my_class_count', (select count(*) from public.classes where user_id = uid),
    'circle', (select to_jsonb(c) from public.circles c where c.id = cid),
    'members', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', p.id, 'display_name', p.display_name, 'avatar_url', p.avatar_url,
               'personal_streak', public.personal_streak(p.id)) order by p.display_name), '[]'::jsonb)
      from public.circle_members m join public.profiles p on p.id = m.user_id
      where m.circle_id = cid),
    'circle_streak', public.circle_streak(cid),
    'personal_streak', public.personal_streak(uid),
    'today', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', o.id, 'user_id', o.user_id, 'display_name', p.display_name,
               'course_code', c.course_code, 'name', c.name, 'building_code', o.building_code,
               'starts_at', o.starts_at, 'ends_at', o.ends_at, 'window_start', o.window_start,
               'window_end', o.window_end, 'skip_deadline', o.skip_deadline,
               'status', o.status, 'is_demo', o.is_demo) order by o.starts_at, p.display_name), '[]'::jsonb)
      from public.class_occurrences o
      join public.classes c on c.id = o.class_id
      join public.profiles p on p.id = o.user_id
      join public.circle_members m on m.user_id = o.user_id and m.circle_id = cid
      where o.date = today),
    'forfeits', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', f.id, 'circle_id', f.circle_id, 'owed_by', f.owed_by, 'owed_by_name', po.display_name,
               'skip_id', f.skip_id, 'description', f.description, 'status', f.status,
               'marked_paid_by', f.marked_paid_by, 'paid_by_name', pp.display_name,
               'paid_at', f.paid_at, 'local_date', f.local_date, 'created_at', f.created_at,
               'course_code', c.course_code, 'starts_at', o.starts_at, 'explanation', s.explanation)
               order by f.created_at desc), '[]'::jsonb)
      from public.forfeits f
      join public.profiles po on po.id = f.owed_by
      left join public.profiles pp on pp.id = f.marked_paid_by
      join public.skips s on s.id = f.skip_id
      join public.class_occurrences o on o.id = s.occurrence_id
      join public.classes c on c.id = o.class_id
      where f.circle_id = cid),
    'my_unexplained_skips', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', s.id, 'occurrence_id', s.occurrence_id, 'course_code', c.course_code,
               'starts_at', o.starts_at, 'created_at', s.created_at) order by s.created_at desc), '[]'::jsonb)
      from public.skips s
      join public.class_occurrences o on o.id = s.occurrence_id
      join public.classes c on c.id = o.class_id
      where s.user_id = uid and s.explanation is null and not s.excused),
    'feed', (
      select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc), '[]'::jsonb)
      from public.feed_events e where e.id = any (recent_ids)),
    'reactions', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'feed_event_id', r.feed_event_id, 'user_id', r.user_id, 'emoji', r.emoji)), '[]'::jsonb)
      from public.reactions r where r.feed_event_id = any (recent_ids))
  );
end $$;

-- ---------------------------------------------------------------- grants

revoke execute on function
  public.ensure_occurrences(date, int, uuid), public.detect_skips(),
  public.personal_streak(uuid), public.circle_streak(uuid),
  public.explain_skip(uuid, text), public.excuse_skip(uuid), public.excuse_occurrence(uuid),
  public.mark_forfeit_paid(uuid), public.create_circle(text, text), public.join_circle(text),
  public.toggle_reaction(uuid, text), public.get_circle_state()
from public, anon;

grant execute on function
  public.ensure_occurrences(date, int, uuid), public.detect_skips(),
  public.personal_streak(uuid), public.circle_streak(uuid),
  public.explain_skip(uuid, text), public.excuse_skip(uuid), public.excuse_occurrence(uuid),
  public.mark_forfeit_paid(uuid), public.create_circle(text, text), public.join_circle(text),
  public.toggle_reaction(uuid, text), public.get_circle_state(),
  public.my_circle_id(), public.same_circle(uuid), public.ny_today()
to authenticated, service_role;
