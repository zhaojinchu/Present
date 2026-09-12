// The class-time state machine, as a pure function so screens and the mock agree and it can be
// unit-checked. The database owns the timestamps; this only reads them against "now".
import type { Occurrence } from './types';

export type Phase = 'upcoming' | 'open' | 'late' | 'closed' | 'posted' | 'posted_late' | 'missed' | 'excused';

export function phaseOf(o: Occurrence, nowMs: number): Phase {
  if (o.status === 'posted') return o.late ? 'posted_late' : 'posted';
  if (o.status === 'missed') return 'missed';
  if (o.status === 'excused') return 'excused';
  const opens = Date.parse(o.opens_at);
  const onTime = Date.parse(o.on_time_until);
  const deadline = Date.parse(o.deadline);
  if (nowMs < opens) return 'upcoming';
  if (nowMs < onTime) return 'open';
  if (nowMs < deadline) return 'late';
  return 'closed';
}

/** Can the user post for this occurrence right now (on time or late)? */
export function canPost(o: Occurrence, nowMs: number): boolean {
  const p = phaseOf(o, nowMs);
  return p === 'open' || p === 'late';
}

/** Is the class in session (used for "3 friends are in class now")? */
export function inClassNow(o: Occurrence, nowMs: number): boolean {
  return Date.parse(o.starts_at) <= nowMs && nowMs < Date.parse(o.ends_at);
}

/**
 * One occurrence per person, never one per class: a friend sitting in two overlapping sessions is
 * still one friend in class. Keeps the most recently started session for each person.
 */
export function onePerPerson(occurrences: Occurrence[]): Occurrence[] {
  const byUser = new Map<string, Occurrence>();
  for (const o of occurrences) {
    const prev = byUser.get(o.user_id);
    if (!prev || Date.parse(o.starts_at) > Date.parse(prev.starts_at)) byUser.set(o.user_id, o);
  }
  return [...byUser.values()];
}

/** Friends in class right now, one entry per friend. */
export function peopleInClass(occurrences: Occurrence[], nowMs: number): Occurrence[] {
  return onePerPerson(occurrences.filter((o) => inClassNow(o, nowMs)));
}

const FOCUS_ORDER: Phase[] = ['open', 'late', 'closed', 'missed', 'upcoming', 'posted_late', 'posted', 'excused'];

/**
 * Which of my occurrences the Today hero should show. Open beats everything; then late, closed,
 * an unexplained miss, the soonest upcoming, and finally the latest posted.
 */
export function focusOccurrence(mine: Occurrence[], nowMs: number, unexplainedOccurrenceIds: Set<string> = new Set()): Occurrence | null {
  if (mine.length === 0) return null;
  const rank = (o: Occurrence): number => {
    const p = phaseOf(o, nowMs);
    if (p === 'missed' && !unexplainedOccurrenceIds.has(o.id)) return FOCUS_ORDER.length; // explained misses sink
    return FOCUS_ORDER.indexOf(p);
  };
  const sorted = [...mine].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    const pa = phaseOf(a, nowMs);
    // upcoming: soonest first; posted: latest first; everything else: by start
    if (pa === 'upcoming') return Date.parse(a.starts_at) - Date.parse(b.starts_at);
    if (pa === 'posted' || pa === 'posted_late') return Date.parse(b.starts_at) - Date.parse(a.starts_at);
    return Date.parse(a.starts_at) - Date.parse(b.starts_at);
  });
  return sorted[0] ?? null;
}

/** Minutes late for a posted-late occurrence, or 0. */
export function minutesLate(o: Occurrence): number {
  if (o.status !== 'posted' || !o.late || !o.posted_at) return 0;
  return Math.max(0, Math.round((Date.parse(o.posted_at) - Date.parse(o.on_time_until)) / 60_000));
}
