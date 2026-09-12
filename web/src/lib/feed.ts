// Feed helpers shared by the feed screen and the friend profile.
import { dayKey, dayLabel } from './time';
import type { Comment, FeedEvent, Reaction } from './types';

export interface FeedSection {
  key: string;
  label: string;
  events: FeedEvent[];
}

export function groupByDay(events: FeedEvent[], nowMs: number): FeedSection[] {
  const out: FeedSection[] = [];
  for (const e of events) {
    const key = dayKey(e.created_at);
    const last = out[out.length - 1];
    if (last && last.key === key) last.events.push(e);
    else out.push({ key, label: dayLabel(e.created_at, nowMs), events: [e] });
  }
  return out;
}

/** Friends see a post's photo for 24 hours; the author always sees their own. */
export function photoExpired(e: FeedEvent, nowMs: number, meId: string | null): boolean {
  if (e.type !== 'post') return false;
  if (e.actor_id === meId) return false;
  const exp = e.payload.expires_at ? Date.parse(e.payload.expires_at) : NaN;
  return Number.isFinite(exp) && exp < nowMs;
}

export function reactionsFor(reactions: Reaction[], eventId: string): Reaction[] {
  return reactions.filter((r) => r.feed_event_id === eventId);
}

export function commentsFor(comments: Comment[], eventId: string): Comment[] {
  return comments.filter((c) => c.feed_event_id === eventId);
}
