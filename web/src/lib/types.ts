// The contract between the backend and every screen: the exact shape of get_state(). Validated
// with zod at the boundary so a backend change fails loudly in one place. Screens import the
// inferred types; they never reach for Supabase rows directly.
import { z } from 'zod';
import { Group } from './groups';

export const OccurrenceStatus = z.enum(['pending', 'posted', 'missed', 'excused']);
export type OccurrenceStatus = z.infer<typeof OccurrenceStatus>;

export const FeedType = z.enum(['post', 'miss', 'excused', 'explanation', 'friends', 'heading_out', 'nudge']);
export type FeedType = z.infer<typeof FeedType>;

export const Relation = z.enum(['none', 'friends', 'incoming', 'outgoing']);
export type Relation = z.infer<typeof Relation>;

const uuid = z.string();
const ts = z.string(); // ISO timestamptz from Postgres

export const MeState = z.object({
  id: uuid,
  username: z.string(),
  display_name: z.string(),
  avatar_url: z.string().nullable(),
  tz: z.string(),
  streak: z.number().int(),
  best_streak: z.number().int(),
  posts_count: z.number().int(),
  class_count: z.number().int(),
  posted_today: z.boolean(),
  has_class_today: z.boolean(),
});
export type MeState = z.infer<typeof MeState>;

export const Friend = z.object({
  id: uuid,
  username: z.string(),
  display_name: z.string(),
  avatar_url: z.string().nullable(),
  streak: z.number().int(),
  best_streak: z.number().int(),
  posted_today: z.boolean(),
});
export type Friend = z.infer<typeof Friend>;

export const FriendRequest = z.object({
  id: uuid, // the other user's id
  username: z.string(),
  display_name: z.string(),
  avatar_url: z.string().nullable(),
  created_at: ts,
});
export type FriendRequest = z.infer<typeof FriendRequest>;

export const PostSummary = z.object({
  id: uuid,
  photo_path: z.string().nullable(),
  photo_back_path: z.string().nullable(),
  caption: z.string().nullable(),
  late: z.boolean(),
  location_verified: z.boolean(),
  retake_count: z.number().int(),
  expires_at: ts,
});
export type PostSummary = z.infer<typeof PostSummary>;

export const Occurrence = z.object({
  id: uuid,
  user_id: uuid,
  username: z.string(),
  display_name: z.string(),
  avatar_url: z.string().nullable(),
  class_id: uuid,
  course_code: z.string(),
  name: z.string().nullable(),
  location_text: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  radius_m: z.number().nullable(),
  date: z.string(), // local date in the class tz, YYYY-MM-DD
  starts_at: ts,
  ends_at: ts,
  opens_at: ts,
  on_time_until: ts,
  deadline: ts,
  status: OccurrenceStatus,
  late: z.boolean(),
  posted_at: ts.nullable(),
  is_demo: z.boolean(),
  post: PostSummary.nullable(),
});
export type Occurrence = z.infer<typeof Occurrence>;

/** Flat union of every payload key. Which keys are present depends on `FeedEvent.type`. */
export const FeedPayload = z
  .object({
    display_name: z.string().optional(),
    username: z.string().optional(),
    avatar_url: z.string().nullable().optional(),
    course_code: z.string().optional(),
    location_text: z.string().nullable().optional(),
    starts_at: ts.optional(),
    posted_at: ts.optional(),
    photo_path: z.string().nullable().optional(),
    photo_back_path: z.string().nullable().optional(),
    caption: z.string().nullable().optional(),
    late: z.boolean().optional(),
    location_verified: z.boolean().optional(),
    retake_count: z.number().int().optional(),
    expires_at: ts.optional(),
    streak_after: z.number().int().optional(),
    streak_before: z.number().int().optional(),
    pre_emptive: z.boolean().optional(),
    reason: z.string().nullable().optional(), // excused: why (announced)
    text: z.string().optional(),
    friend_id: uuid.optional(),
    friend_name: z.string().optional(),
    friend_username: z.string().optional(),
    // heading_out
    ends_at: ts.optional(),
    opens_at: ts.optional(),
    // nudge (actor = who nudged; target = who was nudged)
    target_id: uuid.optional(),
    target_username: z.string().optional(),
    target_name: z.string().optional(),
    target_avatar_url: z.string().nullable().optional(),
    deadline: ts.optional(),
  })
  .loose();
export type FeedPayload = z.infer<typeof FeedPayload>;

export const FeedEvent = z.object({
  id: uuid,
  actor_id: uuid,
  occurrence_id: uuid.nullable(),
  type: FeedType,
  ref_id: uuid.nullable(),
  payload: FeedPayload,
  created_at: ts,
});
export type FeedEvent = z.infer<typeof FeedEvent>;

export const Reaction = z.object({
  id: uuid,
  feed_event_id: uuid,
  user_id: uuid,
  emoji: z.string(),
});
export type Reaction = z.infer<typeof Reaction>;

export const Comment = z.object({
  id: uuid,
  feed_event_id: uuid,
  user_id: uuid,
  username: z.string(),
  display_name: z.string(),
  text: z.string(),
  created_at: ts,
});
export type Comment = z.infer<typeof Comment>;

export const UnexplainedMiss = z.object({
  id: uuid, // misses.id
  occurrence_id: uuid,
  course_code: z.string(),
  starts_at: ts,
});
export type UnexplainedMiss = z.infer<typeof UnexplainedMiss>;

export const AppState = z.object({
  server_time: ts,
  today: z.string(),
  me: MeState,
  friends: z.array(Friend),
  requests: z.object({ incoming: z.array(FriendRequest), outgoing: z.array(FriendRequest) }),
  today_occurrences: z.array(Occurrence),
  my_unexplained_misses: z.array(UnexplainedMiss),
  feed: z.array(FeedEvent),
  reactions: z.array(Reaction),
  comments: z.array(Comment),
  // Circles (contract in ./groups.ts). Defaulted so an older backend still parses.
  groups: z.array(Group).default([]),
});
export type AppState = z.infer<typeof AppState>;

/** A class row as the schedule screens see it (subset of the table). */
export const ClassRow = z.object({
  id: uuid,
  course_code: z.string(),
  name: z.string().nullable(),
  location_text: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  radius_m: z.number().nullable(),
  tz: z.string(),
  days_of_week: z.array(z.number().int()),
  start_time: z.string(), // HH:MM:SS
  end_time: z.string(),
  term_start: z.string().nullable(),
  term_end: z.string().nullable(),
  exdates: z.array(z.string()),
  source: z.enum(['manual', 'ics']),
  ics_uid: z.string().nullable(),
});
export type ClassRow = z.infer<typeof ClassRow>;

/** What the import screen sends to import_classes(). */
export interface ImportClassInput {
  ics_uid: string | null;
  course_code: string;
  name: string | null;
  location_text: string | null;
  days_of_week: number[];
  start_time: string;
  end_time: string;
  tz: string;
  term_start: string | null;
  term_end: string | null;
  exdates: string[];
}

export interface SearchUser {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  relation: Relation;
}
