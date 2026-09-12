-- Present v2 — feed events show the actor as they are now.
-- Payloads are written once (profile_json at post time), so a new profile photo or name never
-- reached old posts. get_state() now overlays the actor's current display_name, username and
-- avatar_url on every feed event it returns. Also drops shared_courses (class-based circle
-- suggestions were removed from the product); the client field has a default.

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
               'type', e.type, 'ref_id', e.ref_id,
               'payload', e.payload || jsonb_build_object('display_name', p.display_name, 'username', p.username, 'avatar_url', p.avatar_url),
               'created_at', e.created_at) order by e.created_at desc), '[]'::jsonb)
      from public.feed_events e join public.profiles p on p.id = e.actor_id where e.id = any (recent)),
    'reactions', (
      select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'feed_event_id', r.feed_event_id, 'user_id', r.user_id, 'emoji', r.emoji)), '[]'::jsonb)
      from public.reactions r where r.feed_event_id = any (recent)),
    'comments', (
      select coalesce(jsonb_agg(jsonb_build_object('id', cm.id, 'feed_event_id', cm.feed_event_id, 'user_id', cm.user_id,
               'username', p.username, 'display_name', p.display_name, 'text', cm.text, 'created_at', cm.created_at) order by cm.created_at), '[]'::jsonb)
      from public.comments cm join public.profiles p on p.id = cm.user_id where cm.feed_event_id = any (recent)),
    'groups', (
      select coalesce(jsonb_agg(public.group_json(g.id, today, week_start, t) order by g.created_at), '[]'::jsonb)
      from public.groups g where g.id in (select public.my_group_ids()))
  );
end $$;
