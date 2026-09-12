-- Present v2 — push delivery, hosted only (pg_net, Vault, cron). The PGlite harness skips this file.
-- Secrets are written to Vault by `npm run push:setup`: vapid_public_key, vapid_private_key,
-- push_hook_secret, push_function_url. Until they exist every hook here is a no-op.

create extension if not exists pg_net;

create or replace function public.push_secret(p_name text) returns text
language sql stable security definer set search_path = public as $$
  select decrypted_secret from vault.decrypted_secrets where name = p_name order by created_at desc limit 1
$$;

-- The client asks for the public key when turning notifications on; it is not secret.
create or replace function public.push_public_key() returns text
language sql stable security definer set search_path = public as $$
  select public.push_secret('vapid_public_key')
$$;

-- The send-push function reads what it needs in one call, with the service role.
create or replace function public.push_secrets() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'vapid_public_key',  public.push_secret('vapid_public_key'),
    'vapid_private_key', public.push_secret('vapid_private_key'),
    'hook_secret',       public.push_secret('push_hook_secret'))
$$;

-- Ask the function to deliver a batch of queue ids. Async: pg_net queues the HTTP call.
create or replace function public.push_kick(p_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare fn_url text := public.push_secret('push_function_url'); secret text := public.push_secret('push_hook_secret');
begin
  if fn_url is null or secret is null or p_ids is null or cardinality(p_ids) = 0 then return; end if;
  perform net.http_post(
    url := fn_url,
    body := jsonb_build_object('ids', to_jsonb(p_ids)),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', secret),
    timeout_milliseconds := 15000);
end $$;

create or replace function public.on_push_queue_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.push_kick(array[new.id]);
  return new;
end $$;

drop trigger if exists push_queue_kick on public.push_queue;
create trigger push_queue_kick
  after insert on public.push_queue
  for each row execute function public.on_push_queue_insert();

-- The hook is fire-and-forget; every minute retry what is still unsent, up to three attempts.
create or replace function public.push_drain() returns int
language plpgsql security definer set search_path = public as $$
declare ids uuid[]; t timestamptz := public.app_now();
begin
  select coalesce(array_agg(id), '{}'::uuid[]) into ids from public.push_queue
   where sent_at is null and attempts < 3 and created_at < t - interval '20 seconds' and created_at > t - interval '1 hour';
  perform public.push_kick(ids);
  return cardinality(ids);
end $$;

revoke execute on function
  public.push_secret(text), public.push_secrets(), public.push_kick(uuid[]), public.on_push_queue_insert(), public.push_drain()
from public, anon, authenticated;
grant execute on function public.push_secret(text), public.push_secrets(), public.push_kick(uuid[]), public.push_drain() to service_role;
revoke execute on function public.push_public_key() from public, anon;
grant execute on function public.push_public_key() to authenticated, service_role;

select cron.schedule('present-push-open-windows', '* * * * *', $$select public.enqueue_open_windows()$$);
select cron.schedule('present-push-drain', '* * * * *', $$select public.push_drain()$$);
