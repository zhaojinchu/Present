-- Present v2 — circle admin. The person who made a circle can remove a member or delete the
-- circle; everyone else still leaves with leave_group. (The UI says circle; the tables say group.)

create or replace function public.remove_from_group(p_group_id uuid, p_user_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); g public.groups;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select * into g from public.groups where id = p_group_id for update;
  if g.id is null or not public.is_group_member(p_group_id, uid) then raise exception 'No such circle'; end if;
  if g.created_by <> uid then raise exception 'Only the person who made the circle can remove people'; end if;
  if p_user_id = uid then raise exception 'Use leave for yourself'; end if;
  delete from public.group_members where group_id = p_group_id and user_id = p_user_id;
  if not found then raise exception 'They are not in this circle'; end if;
  return public.group_state(p_group_id);
end $$;

create or replace function public.delete_group(p_group_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not signed in'; end if;
  delete from public.groups where id = p_group_id and created_by = uid;
  if not found then raise exception 'Only the person who made the circle can delete it'; end if;
end $$;

revoke execute on function public.remove_from_group(uuid, uuid), public.delete_group(uuid) from public, anon;
grant execute on function public.remove_from_group(uuid, uuid), public.delete_group(uuid) to authenticated, service_role;
