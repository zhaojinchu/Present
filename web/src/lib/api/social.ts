// Friend, reaction, comment, explanation and profile writes. Every call is an RPC; the database
// re-checks auth.uid() and visibility. In mock mode the calls resolve without doing anything so
// screens can be exercised end to end.
import { env } from '../config';
import { supabase } from '../supabase';
import type { Relation, SearchUser } from '../types';

async function rpc<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<T> {
  if (env.mockState) {
    console.info('[mock rpc]', fn, args ?? {});
    await new Promise((r) => setTimeout(r, 250));
    return undefined as T;
  }
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
}

export const sendFriendRequest = (username: string) => rpc<Relation>('send_friend_request', { p_username: username });
export const acceptFriendRequest = (userId: string) => rpc('accept_friend_request', { p_user: userId });
export const removeFriend = (userId: string) => rpc('remove_friend', { p_user: userId });
export const usernameAvailable = (username: string) => rpc<boolean>('username_available', { p_username: username });

export async function searchUsers(query: string): Promise<SearchUser[]> {
  if (env.mockState) {
    await new Promise((r) => setTimeout(r, 200));
    const q = query.toLowerCase();
    return [
      { id: 'mock-maya', username: 'maya', display_name: 'Maya Torres', avatar_url: null, relation: 'incoming' as const },
      { id: 'mock-dev', username: 'devon', display_name: 'Devon Park', avatar_url: null, relation: 'none' as const },
      { id: 'mock-sam', username: 'sam', display_name: 'Sam Okafor', avatar_url: null, relation: 'friends' as const },
    ].filter((u) => u.username.startsWith(q) || u.display_name.toLowerCase().includes(q));
  }
  return (await rpc<SearchUser[]>('search_users', { p_query: query })) ?? [];
}

export const toggleReaction = (eventId: string, emoji: string) => rpc<boolean>('toggle_reaction', { p_event_id: eventId, p_emoji: emoji });
export const addComment = (eventId: string, text: string) => rpc('add_comment', { p_event_id: eventId, p_text: text });
export const explainMiss = (missId: string, text: string) => rpc('explain_miss', { p_miss_id: missId, p_text: text });
export const excuseMiss = (missId: string, reason?: string) => rpc('excuse_miss', { p_miss_id: missId, p_reason: reason ?? null });
export const excuseOccurrence = (occurrenceId: string, reason: string) => rpc('excuse_occurrence', { p_occurrence_id: occurrenceId, p_reason: reason });

export const updateProfile = (patch: { display_name?: string; username?: string; avatar_url?: string; tz?: string }) =>
  rpc('update_profile', {
    p_display_name: patch.display_name ?? null,
    p_username: patch.username ?? null,
    p_avatar_url: patch.avatar_url ?? null,
    p_tz: patch.tz ?? null,
  });

/** Demo controls (dev_* RPCs; dropped before any real release). */
export const dev = {
  startClassNow: (course: string, onTimeMin = 2, lateMin = 2) => rpc<number>('dev_start_class_now', { p_course: course, p_on_time_min: onTimeMin, p_late_min: lateMin }),
  endOnTimeNow: () => rpc('dev_end_on_time_now'),
  endWindowNow: () => rpc<number>('dev_end_window_now'),
  reset: () => rpc('dev_reset_demo'),
  pinHere: (lat: number, lng: number) => rpc('dev_pin_here', { p_lat: lat, p_lng: lng }),
  replayPost: (userId: string) => rpc('dev_replay_post', { p_user: userId }),
  replayExplanation: (text: string) => rpc('dev_replay_explanation', { p_text: text }),
  photoWalk: (course: string, location: string, minutes: number) => rpc<string>('dev_photo_walk', { p_course: course, p_location: location || null, p_minutes: minutes }),
  detectMisses: () => rpc<number>('detect_misses'),
  ensureOccurrences: () => rpc<number>('ensure_my_occurrences'),
};
