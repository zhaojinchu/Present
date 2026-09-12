-- Present — pieces that only exist on hosted Supabase (cron, realtime publication, storage).
-- The PGlite test harness (scripts/sql-test.ts) skips this file.

-- Cron. If `create extension` errors, enable pg_cron from Dashboard -> Integrations -> Cron and re-run.
create extension if not exists pg_cron;

select cron.schedule('present-detect-skips', '* * * * *', $$select public.detect_skips()$$);
select cron.schedule('present-ensure-occurrences', '5 4 * * *',
  $$select public.ensure_occurrences((now() at time zone 'America/New_York')::date, 2)$$);
select cron.schedule('present-expire-photos', '0 * * * *',
  $$update public.checkins set photo_path = null, photo_back_path = null
    where expires_at < now() and photo_path is not null$$);

-- Realtime: the feed subscribes to inserts on these two tables.
alter publication supabase_realtime add table public.feed_events, public.reactions;

-- Storage: private bucket, upload only into your own folder, any signed-in user can read.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('checkin-photos', 'checkin-photos', false, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "checkin photos: upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'checkin-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "checkin photos: overwrite own folder" on storage.objects for update to authenticated
  using (bucket_id = 'checkin-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "checkin photos: read" on storage.objects for select to authenticated
  using (bucket_id = 'checkin-photos');
