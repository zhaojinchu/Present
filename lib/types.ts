// Hand-written mirror of the SQL in supabase/migrations. Keep in sync with PLAN.md §2.

export type OccStatus = 'pending' | 'checked_in' | 'skipped' | 'excused';
export type ForfeitStatus = 'owed' | 'paid' | 'voided';
export type FeedType =
  | 'checkin'
  | 'skip'
  | 'excused'
  | 'explanation'
  | 'forfeit_owed'
  | 'forfeit_paid'
  | 'member_joined';

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  created_at?: string;
}

export interface Circle {
  id: string;
  name: string;
  forfeit_text: string;
  invite_code: string;
  created_by: string | null;
  created_at: string;
}

export interface Member {
  id: string;
  display_name: string;
  avatar_url: string | null;
  personal_streak: number;
}

export interface Building {
  code: string;
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
}

export interface ClassRow {
  id: string;
  user_id: string;
  course_code: string;
  name: string | null;
  building_code: string;
  days_of_week: number[]; // 0=Sun .. 6=Sat
  start_time: string; // 'HH:MM:SS'
  end_time: string;
  created_at?: string;
}

export type ClassInput = Omit<ClassRow, 'id' | 'user_id' | 'created_at'> & { id?: string };

/** One member's class on one day, as returned inside get_circle_state().today */
export interface Occurrence {
  id: string;
  user_id: string;
  display_name: string;
  course_code: string;
  name: string | null;
  building_code: string;
  starts_at: string;
  ends_at: string;
  window_start: string;
  window_end: string;
  skip_deadline: string;
  status: OccStatus;
  is_demo: boolean;
}

export interface Forfeit {
  id: string;
  circle_id: string;
  owed_by: string;
  owed_by_name: string;
  skip_id: string;
  description: string;
  status: ForfeitStatus;
  marked_paid_by: string | null;
  paid_by_name: string | null;
  paid_at: string | null;
  local_date: string;
  created_at: string;
  course_code: string;
  starts_at: string;
  explanation: string | null;
}

/** Denormalized display data. Which keys exist depends on FeedEvent.type (PLAN.md §2). */
export interface FeedPayload {
  display_name?: string;
  avatar_url?: string | null;
  course_code?: string;
  photo_path?: string | null;
  photo_back_path?: string | null;
  in_geofence?: boolean;
  personal_streak_after?: number;
  circle_streak_after?: number;
  starts_at?: string;
  personal_streak_before?: number;
  circle_streak_before?: number;
  description?: string;
  forfeit_id?: string;
  text?: string;
  pre_emptive?: boolean;
  paid_by_name?: string;
  paid_by?: string;
  created?: boolean;
}

export interface FeedEvent {
  id: string;
  circle_id: string;
  actor_id: string;
  occurrence_id: string | null;
  type: FeedType;
  ref_id: string | null;
  payload: FeedPayload;
  created_at: string;
}

export interface Reaction {
  feed_event_id: string;
  user_id: string;
  emoji: string;
}

export interface UnexplainedSkip {
  id: string;
  occurrence_id: string;
  course_code: string;
  starts_at: string;
  created_at: string;
}

/** Everything a screen needs, from one RPC call. */
export interface CircleState {
  me: string;
  server_time: string;
  my_class_count: number;
  circle: Circle | null;
  members: Member[];
  circle_streak: number;
  personal_streak: number;
  today: Occurrence[];
  forfeits: Forfeit[];
  my_unexplained_skips: UnexplainedSkip[];
  feed: FeedEvent[];
  reactions: Reaction[];
}

export function normalizeState(raw: Partial<CircleState> & { me: string; server_time: string }): CircleState {
  return {
    me: raw.me,
    server_time: raw.server_time,
    my_class_count: raw.my_class_count ?? 0,
    circle: raw.circle ?? null,
    members: raw.members ?? [],
    circle_streak: raw.circle_streak ?? 0,
    personal_streak: raw.personal_streak ?? 0,
    today: raw.today ?? [],
    forfeits: raw.forfeits ?? [],
    my_unexplained_skips: raw.my_unexplained_skips ?? [],
    feed: raw.feed ?? [],
    reactions: raw.reactions ?? [],
  };
}
