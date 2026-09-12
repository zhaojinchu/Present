import { supabase } from '../supabase';
import type { Circle } from '../types';

export async function createCircle(name: string, forfeitText: string): Promise<Circle> {
  const { data, error } = await supabase.rpc('create_circle', { p_name: name, p_forfeit_text: forfeitText });
  if (error) throw error;
  return data as Circle;
}

export async function joinCircle(code: string): Promise<Circle> {
  const { data, error } = await supabase.rpc('join_circle', { p_code: code });
  if (error) throw error;
  return data as Circle;
}

export async function markForfeitPaid(forfeitId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_forfeit_paid', { p_forfeit_id: forfeitId });
  if (error) throw error;
}

export async function explainSkip(skipId: string, text: string): Promise<void> {
  const { error } = await supabase.rpc('explain_skip', { p_skip_id: skipId, p_text: text });
  if (error) throw error;
}

/** After-the-fact excuse: voids the forfeit and restores the streak. */
export async function excuseSkip(skipId: string): Promise<void> {
  const { error } = await supabase.rpc('excuse_skip', { p_skip_id: skipId });
  if (error) throw error;
}

/** Pre-emptive excuse from Home, before the deadline. */
export async function excuseOccurrence(occurrenceId: string): Promise<void> {
  const { error } = await supabase.rpc('excuse_occurrence', { p_occurrence_id: occurrenceId });
  if (error) throw error;
}

/** Returns true if the reaction was added, false if removed. */
export async function toggleReaction(eventId: string, emoji: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('toggle_reaction', { p_event_id: eventId, p_emoji: emoji });
  if (error) throw error;
  return Boolean(data);
}
