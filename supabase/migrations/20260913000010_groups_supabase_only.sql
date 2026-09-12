-- Present v2 — groups: hosted-only pieces. The PGlite test harness skips this file.
-- Realtime: the client channel invalidates the state on any change to these; RLS scopes delivery.
alter publication supabase_realtime add table
  public.groups, public.group_members, public.group_forfeits, public.miss_votes, public.miss_vouches;
