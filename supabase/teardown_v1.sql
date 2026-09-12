-- Present — one-shot teardown of the v1 (circles) schema on the hosted project.
-- Run ONCE before applying the v2 migrations (20260913*). Lives outside migrations/ so the
-- PGlite harness and `supabase db push` never see it. Everything here is test data.

do $$
declare j record;
begin
  for j in select jobname from cron.job where jobname like 'present-%' loop
    perform cron.unschedule(j.jobname);
  end loop;
exception when others then
  null; -- pg_cron not installed
end $$;

drop policy if exists "checkin photos: upload to own folder" on storage.objects;
drop policy if exists "checkin photos: overwrite own folder" on storage.objects;
drop policy if exists "checkin photos: read" on storage.objects;

drop trigger if exists on_auth_user_created on auth.users;

drop table if exists
  public.push_tokens, public.reactions, public.feed_events, public.forfeits, public.skips, public.checkins,
  public.class_occurrences, public.classes, public.buildings, public.circle_members, public.circles, public.profiles
cascade;

drop function if exists
  public.ny_today(), public.my_circle_id(), public.same_circle(uuid),
  public.ensure_occurrences(date, int, uuid), public.on_class_change(),
  public.personal_streak(uuid), public.circle_streak(uuid),
  public.on_checkin_insert(), public.detect_skips(), public.on_skip_update(),
  public.explain_skip(uuid, text), public.excuse_skip(uuid), public.excuse_occurrence(uuid),
  public.mark_forfeit_paid(uuid), public.create_circle(text, text), public.join_circle(text),
  public.toggle_reaction(uuid, text), public.get_circle_state(), public.handle_new_user(),
  public.dev_reset_demo(), public.dev_start_class_now(text, int, int), public.dev_end_window_now(),
  public.dev_set_demo_building(double precision, double precision), public.dev_replay_checkin(uuid),
  public.dev_replay_explanation(text), public.dev_replay_pay_forfeit()
cascade;

drop type if exists public.occ_status, public.forfeit_status, public.feed_type cascade;

-- All accounts are demo accounts; v2 profiles need the username metadata anyway.
delete from auth.users;

-- Keep the migration history honest.
delete from supabase_migrations.schema_migrations where version like '20260912%';
