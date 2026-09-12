-- Present v2 — row level security
-- Reads are scoped to "me and my accepted friends" (visible_users()). Writes that need
-- cross-row consistency (occurrences, posts, misses, feed, reactions, comments, friendships)
-- only happen through security-definer RPCs, so those tables are select-only here.

alter table public.profiles           enable row level security;
alter table public.friendships        enable row level security;
alter table public.classes            enable row level security;
alter table public.class_occurrences  enable row level security;
alter table public.posts              enable row level security;
alter table public.misses             enable row level security;
alter table public.feed_events        enable row level security;
alter table public.reactions          enable row level security;
alter table public.comments           enable row level security;
alter table public.push_subscriptions enable row level security;

-- Profiles are public within the app (search by username needs them); only you edit yours.
create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy friendships_select on public.friendships for select to authenticated
  using (auth.uid() in (user_lo, user_hi));

-- Manual schedule entry writes the table directly; imports go through import_classes().
create policy classes_select on public.classes for select to authenticated
  using (user_id in (select public.visible_users()));
create policy classes_insert on public.classes for insert to authenticated with check (user_id = auth.uid());
create policy classes_update on public.classes for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy classes_delete on public.classes for delete to authenticated using (user_id = auth.uid());

create policy occurrences_select on public.class_occurrences for select to authenticated
  using (user_id in (select public.visible_users()));

-- Friends see the row; the client hides the photo once payload.expires_at has passed.
create policy posts_select on public.posts for select to authenticated
  using (user_id in (select public.visible_users()));

create policy misses_select on public.misses for select to authenticated
  using (user_id in (select public.visible_users()));

create policy feed_events_select on public.feed_events for select to authenticated
  using (actor_id in (select public.visible_users()));

create policy reactions_select on public.reactions for select to authenticated
  using (public.event_visible(feed_event_id));

create policy comments_select on public.comments for select to authenticated
  using (public.event_visible(feed_event_id));

create policy push_subscriptions_all on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
