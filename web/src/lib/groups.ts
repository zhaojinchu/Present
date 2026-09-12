// Circles (called "groups" in the database and in get_state().groups; the UI says circle everywhere):
// the zod contract for the `groups` and `shared_courses` parts of get_state(), and the pure helpers
// screens use (roll call, standings, forfeit and vote lookups). The backend owns the numbers; nothing
// here reaches Supabase.
import { z } from 'zod';
import type { FeedEvent, Occurrence } from './types';
import { sameSession } from './presence';

const uuid = z.string();
const ts = z.string();
const int = z.number().int();

export const GroupMember = z.object({
  id: uuid,
  username: z.string(),
  display_name: z.string(),
  avatar_url: z.string().nullable(),
  streak: int,
  posted_today: z.boolean(),
});
export type GroupMember = z.infer<typeof GroupMember>;

export const GroupWeek = z.object({
  made: int,
  total: int,
  on_time: int,
  late: int,
  missed: int,
  upcoming: int,
});
export type GroupWeek = z.infer<typeof GroupWeek>;

export const Standing = z.object({
  id: uuid,
  made: int,
  total: int,
  on_time: int,
  late: int,
  missed: int,
});
export type Standing = z.infer<typeof Standing>;

export const ForfeitStatus = z.enum(['owed', 'paid', 'voided']);
export type ForfeitStatus = z.infer<typeof ForfeitStatus>;

export const GroupForfeit = z.object({
  id: uuid,
  miss_id: uuid,
  user_id: uuid,
  status: ForfeitStatus,
  paid_by: uuid.nullable(),
  paid_at: ts.nullable(),
  created_at: ts,
  course_code: z.string(),
  starts_at: ts,
});
export type GroupForfeit = z.infer<typeof GroupForfeit>;

export const MissVote = z.object({ miss_id: uuid, user_id: uuid, fair: z.boolean() });
export type MissVote = z.infer<typeof MissVote>;

export const MissVouch = z.object({ miss_id: uuid, voucher_id: uuid });
export type MissVouch = z.infer<typeof MissVouch>;

export const Group = z.object({
  id: uuid,
  name: z.string(),
  emoji: z.string().nullable(),
  invite_code: z.string(),
  forfeit_text: z.string().nullable(),
  created_by: uuid,
  created_at: ts,
  members: z.array(GroupMember),
  streak: int,
  best_streak: int,
  week: GroupWeek,
  standings: z.array(Standing),
  forfeits: z.array(GroupForfeit),
  votes: z.array(MissVote),
  vouches: z.array(MissVouch),
  excused_miss_ids: z.array(uuid),
});
export type Group = z.infer<typeof Group>;

export const SharedCourse = z.object({
  course_code: z.string(),
  name: z.string().nullable(),
  user_ids: z.array(uuid),
});
export type SharedCourse = z.infer<typeof SharedCourse>;

// ---------------------------------------------------------------- helpers

export function groupLabel(g: Pick<Group, 'name' | 'emoji'>): string {
  return g.emoji ? `${g.emoji} ${g.name}` : g.name;
}

export function memberIds(g: Group): Set<string> {
  return new Set(g.members.map((m) => m.id));
}

/** Events by this group's members (the group feed). */
export function eventsForGroup(events: FeedEvent[], g: Group): FeedEvent[] {
  const ids = memberIds(g);
  return events.filter((e) => ids.has(e.actor_id));
}

export interface RollCallSession {
  key: string;
  course_code: string;
  name: string | null;
  location_text: string | null;
  starts_at: string;
  ends_at: string;
  opens_at: string;
  on_time_until: string;
  deadline: string;
  /** One occurrence per member in this session, in member order. */
  occurrences: Occurrence[];
}

/**
 * Today's class sessions that two or more members of the group share, with each member's
 * occurrence so the screen can draw who is present, missing or still to come.
 */
export function rollCall(today: Occurrence[], g: Group): RollCallSession[] {
  const ids = memberIds(g);
  const mine = today.filter((o) => ids.has(o.user_id));
  const sessions = new Map<string, RollCallSession>();
  for (const o of mine) {
    const key = `${o.course_code}@${Date.parse(o.starts_at)}`;
    const s = sessions.get(key);
    if (s) s.occurrences.push(o);
    else
      sessions.set(key, {
        key,
        course_code: o.course_code,
        name: o.name,
        location_text: o.location_text,
        starts_at: o.starts_at,
        ends_at: o.ends_at,
        opens_at: o.opens_at,
        on_time_until: o.on_time_until,
        deadline: o.deadline,
        occurrences: [o],
      });
  }
  return [...sessions.values()].filter((s) => s.occurrences.length >= 2).sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
}

/** The roll-call session, if any, that matches an occurrence (for a group's compact strip). */
export function sessionFor(sessions: RollCallSession[], o: { course_code: string; starts_at: string }): RollCallSession | null {
  return sessions.find((s) => sameSession(s, o)) ?? null;
}

/** Standings sorted: most classes made, then most on time, then name. */
export function sortedStandings(g: Group): (Standing & GroupMember)[] {
  const byId = new Map(g.members.map((m) => [m.id, m]));
  return g.standings
    .map((s) => ({ ...s, ...(byId.get(s.id) ?? { id: s.id, username: '', display_name: 'Someone', avatar_url: null, streak: 0, posted_today: false }) }))
    .sort((a, b) => b.made - a.made || b.on_time - a.on_time || a.display_name.localeCompare(b.display_name));
}

export interface MissInGroup {
  group: Group;
  forfeit: GroupForfeit | null;
  fair: number;
  unfair: number;
  myVote: boolean | null;
  vouchers: string[];
  excused: boolean;
  /** Fair votes needed for the group to excuse it (majority of the other members). */
  needed: number;
}

/** Everything a group knows about one miss (by miss id): forfeit, votes, vouches, verdict. */
export function missInGroup(g: Group, missId: string, meId: string | null): MissInGroup {
  const votes = g.votes.filter((v) => v.miss_id === missId);
  const vouches = g.vouches.filter((v) => v.miss_id === missId);
  return {
    group: g,
    forfeit: g.forfeits.find((f) => f.miss_id === missId) ?? null,
    fair: votes.filter((v) => v.fair).length,
    unfair: votes.filter((v) => !v.fair).length,
    myVote: votes.find((v) => v.user_id === meId)?.fair ?? null,
    vouchers: vouches.map((v) => v.voucher_id),
    excused: g.excused_miss_ids.includes(missId),
    needed: Math.floor((g.members.length - 1) / 2) + 1,
  };
}

/** Groups (of mine) that the actor of a miss belongs to. */
export function groupsSharedWith(groups: Group[], userId: string): Group[] {
  return groups.filter((g) => g.members.some((m) => m.id === userId));
}

export function forfeitLine(f: GroupForfeit, g: Group, byId: Map<string, GroupMember>): string {
  const who = byId.get(f.user_id)?.display_name ?? 'Someone';
  const what = g.forfeit_text ?? 'the forfeit';
  if (f.status === 'paid') return `${who} paid: ${what}`;
  if (f.status === 'voided') return `${who}: ${what}, waived`;
  return `${who} owes the group: ${what}`;
}

export const GROUP_EMOJI = ['🏠', '📚', '🔥', '☕', '🧠', '🎯', '🚀', '🐢'] as const;
export const FORFEIT_PRESETS = ['buys everyone boba', 'does the dishes', 'brings snacks to the next lecture', 'sends a voice note apology'] as const;
export const GROUP_MAX_MEMBERS = 8;
