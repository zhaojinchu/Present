-- Present v2 — push notifications: the queue and what fills it.
-- Delivery is hosted-only (000013: pg_net hook, cron, Vault secrets, the send-push edge function).
-- Clients never read the queue; it is written by triggers and drained by the function.
--
-- What gets a notification: a friend request (to the other person), an accepted request (to the
-- requester), a class window opening (to its owner, once), a miss (to the misser), and a comment
-- on your post or miss (to you). `tag` is unique so a thing is never announced twice.

create table public.push_queue (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  title      text not null,
  body       text not null default '',
  url        text not null default '/',
  tag        text not null unique,
  created_at timestamptz not null default public.app_now(),
  sent_at    timestamptz,
  attempts   int not null default 0,
  last_error text
);
create index push_queue_unsent on public.push_queue (created_at) where sent_at is null;
alter table public.push_queue enable row level security;   -- no policies on purpose

create or replace function public.push_enqueue(p_user uuid, p_title text, p_body text, p_url text, p_tag text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_user is null or p_tag is null then return; end if;
  insert into public.push_queue (user_id, title, body, url, tag, created_at)
  values (p_user, left(coalesce(p_title, 'Present'), 80), left(coalesce(p_body, ''), 160), coalesce(p_url, '/'), p_tag, public.app_now())
  on conflict (tag) do nothing;
end $$;

-- ---------------------------------------------------------------- friends

create or replace function public.on_friendship_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare other uuid; p public.profiles;
begin
  other := case when new.requested_by = new.user_lo then new.user_hi else new.user_lo end;
  if tg_op = 'INSERT' and new.status = 'pending' then
    select * into p from public.profiles where id = new.requested_by;
    perform public.push_enqueue(other, 'Friend request', p.display_name || ' (@' || p.username || ') wants to be friends', '/friends',
      'friend-req:' || new.user_lo || ':' || new.user_hi || ':' || extract(epoch from new.created_at)::bigint);
  elsif tg_op = 'UPDATE' and new.status = 'accepted' and old.status = 'pending' then
    select * into p from public.profiles where id = other;
    perform public.push_enqueue(new.requested_by, 'You and ' || split_part(p.display_name, ' ', 1) || ' are friends', 'Their classes show up in your feed now.', '/u/' || p.username,
      'friend-ok:' || new.user_lo || ':' || new.user_hi || ':' || extract(epoch from coalesce(new.accepted_at, public.app_now()))::bigint);
  end if;
  return new;
end $$;

create trigger friendships_push
  after insert or update on public.friendships
  for each row execute function public.on_friendship_push();

-- ---------------------------------------------------------------- misses

create or replace function public.on_miss_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare cc text;
begin
  if new.excused then return new; end if;
  select c.course_code into cc from public.class_occurrences o join public.classes c on c.id = o.class_id where o.id = new.occurrence_id;
  perform public.push_enqueue(new.user_id, 'You missed ' || coalesce(cc, 'class'), 'Your friends can see it. Explain yourself.', '/explain/' || new.id, 'miss:' || new.id);
  return new;
end $$;

create trigger misses_push
  after insert on public.misses
  for each row execute function public.on_miss_push();

-- ---------------------------------------------------------------- comments

create or replace function public.on_comment_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare e public.feed_events; p public.profiles;
begin
  select * into e from public.feed_events where id = new.feed_event_id;
  if e.id is null or e.actor_id = new.user_id then return new; end if;
  select * into p from public.profiles where id = new.user_id;
  perform public.push_enqueue(e.actor_id,
    split_part(p.display_name, ' ', 1) || ' commented on your ' || case when e.type = 'miss' then 'miss' else 'post' end,
    new.text, '/comments/' || e.id, 'comment:' || new.id);
  return new;
end $$;

create trigger comments_push
  after insert on public.comments
  for each row execute function public.on_comment_push();

-- ---------------------------------------------------------------- class windows

-- Every minute (cron, 000013): classes whose window opened in the last three minutes and are still
-- unposted. The tag makes repeats a no-op.
create or replace function public.enqueue_open_windows() returns int
language plpgsql security definer set search_path = public as $$
declare n int := 0; r record; t timestamptz := public.app_now();
begin
  for r in
    select o.id, o.user_id, o.on_time_until, c.course_code
    from public.class_occurrences o
    join public.classes c on c.id = o.class_id
    where o.status = 'pending' and o.opens_at <= t and o.opens_at > t - interval '3 minutes'
  loop
    perform public.push_enqueue(r.user_id, r.course_code || ' is open',
      'Present now. ' || greatest(1, floor(extract(epoch from (r.on_time_until - t)) / 60))::int || ' min to stay on time.',
      '/post/' || r.id, 'open:' || r.id);
    n := n + 1;
  end loop;
  return n;
end $$;

revoke execute on function
  public.push_enqueue(uuid, text, text, text, text), public.on_friendship_push(), public.on_miss_push(),
  public.on_comment_push(), public.enqueue_open_windows()
from public, anon, authenticated;
grant execute on function
  public.push_enqueue(uuid, text, text, text, text), public.enqueue_open_windows()
to service_role;
