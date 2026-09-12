-- Present v2 — a test notification for the person who just turned notifications on.
create or replace function public.push_test() returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not signed in'; end if;
  perform public.push_enqueue(uid, 'Notifications are on', 'This is what a class opening will look like.', '/today',
    'test:' || uid || ':' || extract(epoch from public.app_now())::bigint);
end $$;
revoke execute on function public.push_test() from public, anon;
grant execute on function public.push_test() to authenticated, service_role;
