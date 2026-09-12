-- Present — row level security
-- Writes that need cross-row consistency (occurrences, skips, forfeits, feed) only
-- happen through security-definer functions, so most tables are select-only here.

alter table public.profiles          enable row level security;
alter table public.circles           enable row level security;
alter table public.circle_members    enable row level security;
alter table public.buildings         enable row level security;
alter table public.classes           enable row level security;
alter table public.class_occurrences enable row level security;
alter table public.checkins          enable row level security;
alter table public.skips             enable row level security;
alter table public.forfeits          enable row level security;
alter table public.feed_events       enable row level security;
alter table public.reactions         enable row level security;
alter table public.push_tokens       enable row level security;

create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy circles_select on public.circles for select to authenticated using (id = public.my_circle_id());
create policy circles_update on public.circles for update to authenticated
  using (id = public.my_circle_id()) with check (id = public.my_circle_id());

create policy circle_members_select on public.circle_members for select to authenticated
  using (circle_id = public.my_circle_id());

create policy buildings_select on public.buildings for select to authenticated using (true);

create policy classes_select on public.classes for select to authenticated
  using (user_id = auth.uid() or public.same_circle(user_id));
create policy classes_insert on public.classes for insert to authenticated with check (user_id = auth.uid());
create policy classes_update on public.classes for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy classes_delete on public.classes for delete to authenticated using (user_id = auth.uid());

create policy occurrences_select on public.class_occurrences for select to authenticated
  using (user_id = auth.uid() or public.same_circle(user_id));

create policy checkins_select on public.checkins for select to authenticated
  using (user_id = auth.uid() or public.same_circle(user_id));
create policy checkins_insert on public.checkins for insert to authenticated with check (user_id = auth.uid());

create policy skips_select on public.skips for select to authenticated
  using (user_id = auth.uid() or public.same_circle(user_id));

create policy forfeits_select on public.forfeits for select to authenticated
  using (circle_id = public.my_circle_id());

create policy feed_events_select on public.feed_events for select to authenticated
  using (circle_id = public.my_circle_id());

create policy reactions_select on public.reactions for select to authenticated
  using (circle_id = public.my_circle_id());

create policy push_tokens_all on public.push_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
