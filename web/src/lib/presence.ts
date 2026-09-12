// Pure helpers for grouping posts from the same class session into a deck. No Supabase here.
import type { FeedEvent } from './types';

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
