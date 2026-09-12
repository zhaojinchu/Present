// Pure helpers for the "before the miss" social layer: grouping posts from the same class into a
// deck, who is heading to a class, and nudges aimed at me. No Supabase here; screens pass state in.
import type { FeedEvent, Occurrence } from './types';

const HOUR = 3_600_000;

/** Same class session: same course, same start instant. */
export function sameSession(a: { course_code?: string | null; starts_at?: string | null }, b: { course_code?: string | null; starts_at?: string | null }): boolean {
  if (!a.course_code || !b.course_code || a.course_code !== b.course_code) return false;
  if (!a.starts_at || !b.starts_at) return false;
  return Date.parse(a.starts_at) === Date.parse(b.starts_at);
}

export interface PostGroup {
  key: string;
  course_code: string;
  starts_at: string;
  location_text: string | null;
  /** Newest first, as they arrived in the feed. */
  events: FeedEvent[];
}

export type FeedRow = { kind: 'event'; event: FeedEvent } | { kind: 'group'; group: PostGroup };

/**
 * Posts from the same class session become one deck at the position of the newest one. Other
 * events keep their place. Only groups of two or more; a lone post stays a normal post.
 */
export function groupPosts(events: FeedEvent[]): FeedRow[] {
  const groups = new Map<string, PostGroup>();
  for (const e of events) {
    if (e.type !== 'post' || !e.payload.course_code || !e.payload.starts_at) continue;
    const key = `${e.payload.course_code}@${Date.parse(e.payload.starts_at)}`;
    const g = groups.get(key);
    if (g) g.events.push(e);
    else groups.set(key, { key, course_code: e.payload.course_code, starts_at: e.payload.starts_at, location_text: e.payload.location_text ?? null, events: [e] });
  }
  const placed = new Set<string>();
  const rows: FeedRow[] = [];
  for (const e of events) {
    if (e.type === 'post' && e.payload.course_code && e.payload.starts_at) {
      const key = `${e.payload.course_code}@${Date.parse(e.payload.starts_at)}`;
      const g = groups.get(key);
      if (g && g.events.length > 1) {
        if (!placed.has(key)) {
          placed.add(key);
          rows.push({ kind: 'group', group: g });
        }
        continue;
      }
    }
    rows.push({ kind: 'event', event: e });
  }
  return rows;
}

/** Friends who said "leaving now" for this class session, newest first, one per person. */
export function headingOutFor(events: FeedEvent[], session: { course_code: string; starts_at: string }, nowMs: number): FeedEvent[] {
  const seen = new Set<string>();
  const out: FeedEvent[] = [];
  for (const e of events) {
    if (e.type !== 'heading_out') continue;
    if (!sameSession(e.payload, session)) continue;
    if (nowMs - Date.parse(e.created_at) > 3 * HOUR) continue;
    if (seen.has(e.actor_id)) continue;
    seen.add(e.actor_id);
    out.push(e);
  }
  return out;
}

/** Have I already nudged this occurrence? */
export function alreadyNudged(events: FeedEvent[], meId: string | null, occurrenceId: string): boolean {
  return events.some((e) => e.type === 'nudge' && e.actor_id === meId && e.occurrence_id === occurrenceId);
}

/** Nudges aimed at me in the last 30 minutes, newest first. */
export function nudgesForMe(events: FeedEvent[], meId: string | null, nowMs: number): FeedEvent[] {
  if (!meId) return [];
  return events.filter((e) => e.type === 'nudge' && e.payload.target_id === meId && nowMs - Date.parse(e.created_at) < 30 * 60_000);
}

/** Friends' occurrences for the same session as mine that are still pending (nudge candidates). */
export function pendingFriendsFor(theirs: Occurrence[], session: { course_code: string; starts_at: string }): Occurrence[] {
  return theirs.filter((o) => o.status === 'pending' && sameSession(o, session));
}

export function firstName(name: string | null | undefined): string {
  return (name ?? 'Someone').split(' ')[0] ?? 'Someone';
}

/** "Priya", "Priya and Jordan", "Priya, Jordan and Sam", "Priya, Jordan and 2 others". */
export function listNames(names: string[], max = 3): string {
  const n = names.map(firstName);
  if (n.length === 0) return '';
  if (n.length === 1) return n[0];
  if (n.length <= max) return `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`;
  const rest = n.length - (max - 1);
  return `${n.slice(0, max - 1).join(', ')} and ${rest} others`;
}
