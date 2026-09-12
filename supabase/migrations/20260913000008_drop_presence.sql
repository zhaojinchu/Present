-- Present v2 — remove the "before the miss" RPCs (heading out, nudge). Product decision, 12 Sep 2026:
-- they were clutter next to the one goal, attending class. get_stats() stays. The enum values
-- 'heading_out' and 'nudge' remain on feed_type because Postgres cannot drop enum values; no
-- function writes them any more and the client renders unknown types as nothing.

drop function if exists public.head_out(uuid);
drop function if exists public.nudge(uuid);

-- Rows written while the feature was live (reactions and comments cascade).
delete from public.feed_events where type in ('heading_out', 'nudge');
