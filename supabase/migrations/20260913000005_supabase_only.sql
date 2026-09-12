-- Present v2 — pieces that only exist on hosted Supabase (cron, realtime publication, storage).
-- The PGlite test harness (scripts/sql-test.mts) skips this file.

-- Cron. If `create extension` errors, enable pg_cron from Dashboard -> Integrations -> Cron and re-run.
create extension if not exists pg_cron;

do $$
declare j record;
begin
  for j in select jobname from cron.job where jobname like 'present-%' loop
    perform cron.unschedule(j.jobname);
  end loop;
end $$;

select cron.schedule('present-detect-misses', '* * * * *', $$select public.detect_misses()$$);
-- 04:05 UTC: yesterday, today and tomorrow in every zone, idempotent.
select cron.schedule('present-ensure-occurrences', '5 4 * * *', $$select public.ensure_occurrences(current_date - 1, 3)$$);
select cron.schedule('present-expire-photos', '0 * * * *', $$select public.expire_photos()$$);

-- Realtime: the client subscribes to inserts on these with no filter; RLS scopes delivery.
alter publication supabase_realtime add table public.feed_events, public.reactions, public.comments, public.friendships;

-- Storage: private bucket, upload only into your own folder, read your own photos and friends'
-- photos that have not expired.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('checkin-photos', 'checkin-photos', false, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;

drop policy if exists "checkin photos: upload to own folder" on storage.objects;
drop policy if exists "checkin photos: overwrite own folder" on storage.objects;
drop policy if exists "checkin photos: read" on storage.objects;

create policy "checkin photos: upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'checkin-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "checkin photos: overwrite own folder" on storage.objects for update to authenticated
  using (bucket_id = 'checkin-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "checkin photos: read" on storage.objects for select to authenticated
  using (
    bucket_id = 'checkin-photos' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.posts p
        where (p.photo_path = storage.objects.name or p.photo_back_path = storage.objects.name)
          and p.user_id in (select public.visible_users())
          and (p.user_id = auth.uid() or p.expires_at > public.app_now()))));
