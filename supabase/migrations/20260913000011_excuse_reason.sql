-- Present v2 — "Can't make it" needs a reason, and the reason is announced.
-- Product decision, 12 Sep 2026: skipping a class pre-emptively is public. excuse_occurrence now
-- requires a reason; it is stored as the miss's explanation and carried on the excused feed event
-- (payload.reason) so friends see why. excuse_miss (after the fact) takes an optional reason: it
-- becomes the first comment under the miss, via on_miss_update, and rides on the excused event.
-- Both keep the streak; the announcement is the point.

drop function if exists public.excuse_occurrence(uuid);
drop function if exists public.excuse_miss(uuid);

create or replace function public.on_miss_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare ev uuid; p public.profiles; cc text; sa timestamptz; t timestamptz := public.app_now();
begin
  select id into ev from public.feed_events where type = 'miss' and ref_id = new.id limit 1;

  if new.explanation is distinct from old.explanation and new.explanation is not null and ev is not null then
    insert into public.comments (feed_event_id, user_id, text, created_at) values (ev, new.user_id, new.explanation, t);
  end if;

  if new.excused and not old.excused then
    update public.class_occurrences set status = 'excused' where id = new.occurrence_id and status = 'missed';
    select * into p from public.profiles where id = new.user_id;
    select c.course_code, o.starts_at into cc, sa
      from public.class_occurrences o join public.classes c on c.id = o.class_id where o.id = new.occurrence_id;
    insert into public.feed_events (actor_id, occurrence_id, type, ref_id, payload, created_at)
    values (new.user_id, new.occurrence_id, 'excused', new.id,
            public.profile_json(p) || jsonb_build_object('course_code', cc, 'starts_at', sa, 'pre_emptive', false, 'reason', new.explanation), t);
  end if;
  return new;
end $$;

create or replace function public.excuse_miss(p_miss_id uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare reason text := nullif(left(trim(coalesce(p_reason, '')), 140), '');
begin
  update public.misses set excused = true, explanation = coalesce(explanation, reason)
   where id = p_miss_id and user_id = auth.uid() and not excused;
  if not found then raise exception 'Miss not found or already excused'; end if;
end $$;

-- Pre-emptive ("Can't make it"), before the deadline. The reason is required and public.
create or replace function public.excuse_occurrence(p_occurrence_id uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  o public.class_occurrences; uid uuid := auth.uid(); p public.profiles; cc text; m_id uuid; t timestamptz := public.app_now();
  reason text := nullif(left(trim(coalesce(p_reason, '')), 140), '');
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if reason is null then raise exception 'Say why you cannot make it'; end if;
  select * into o from public.class_occurrences where id = p_occurrence_id for update;
  if o.id is null or o.user_id <> uid then raise exception 'That is not your class'; end if;
  if o.status <> 'pending' then raise exception 'This class is already %', o.status; end if;

  update public.class_occurrences set status = 'excused' where id = o.id;
  insert into public.misses (occurrence_id, user_id, excused, explanation, created_at)
  values (o.id, uid, true, reason, t) returning id into m_id;
  select * into p from public.profiles where id = uid;
  select course_code into cc from public.classes where id = o.class_id;
  insert into public.feed_events (actor_id, occurrence_id, type, ref_id, payload, created_at)
  values (uid, o.id, 'excused', m_id,
          public.profile_json(p) || jsonb_build_object('course_code', cc, 'starts_at', o.starts_at, 'pre_emptive', true, 'reason', reason), t);
end $$;

revoke execute on function public.excuse_occurrence(uuid, text), public.excuse_miss(uuid, text) from public, anon;
grant execute on function public.excuse_occurrence(uuid, text), public.excuse_miss(uuid, text) to authenticated, service_role;
