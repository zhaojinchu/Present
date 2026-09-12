// Group writes. Every call is an RPC; the database re-checks membership and friendship. In mock
// mode the calls resolve without doing anything so screens can be exercised end to end.
import { env } from '../config';
import { supabase } from '../supabase';
import type { Group } from '../groups';

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

export const createGroup = (name: string, emoji: string | null, forfeitText: string | null) =>
  rpc<Group>('create_group', { p_name: name, p_emoji: emoji, p_forfeit_text: forfeitText });
export const joinGroup = (code: string) => rpc<Group>('join_group', { p_code: code.trim().toUpperCase() });
export const addToGroup = (groupId: string, userId: string) => rpc('add_to_group', { p_group_id: groupId, p_user_id: userId });
export const leaveGroup = (groupId: string) => rpc('leave_group', { p_group_id: groupId });
/** Creator only, never yourself (use leaveGroup). */
export const removeFromGroup = (groupId: string, userId: string) => rpc<Group>('remove_from_group', { p_group_id: groupId, p_user_id: userId });
/** Creator only; cascades forfeits, votes and vouches. */
export const deleteGroup = (groupId: string) => rpc('delete_group', { p_group_id: groupId });
export const updateGroup = (groupId: string, patch: { name?: string; emoji?: string | null; forfeit_text?: string | null }) =>
  rpc('update_group', { p_group_id: groupId, p_name: patch.name ?? null, p_emoji: patch.emoji ?? null, p_forfeit_text: patch.forfeit_text ?? null });
export const markForfeitPaid = (forfeitId: string) => rpc('mark_forfeit_paid', { p_forfeit_id: forfeitId });
export const voteMiss = (missId: string, groupId: string, fair: boolean) => rpc('vote_miss', { p_miss_id: missId, p_group_id: groupId, p_fair: fair });
export const vouchMiss = (missId: string, groupId: string) => rpc('vouch_miss', { p_miss_id: missId, p_group_id: groupId });
