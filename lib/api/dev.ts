import { supabase } from '../supabase';

async function call<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
}

export const dev = {
  startClassNow: (course: string, windowMin = 3, skipAfterMin = 3) =>
    call<number>('dev_start_class_now', { p_course: course, p_window_min: windowMin, p_skip_after_min: skipAfterMin }),
  endWindowNow: () => call<number>('dev_end_window_now'),
  resetDemo: () => call<number>('dev_reset_demo'),
  setDemoBuilding: (lat: number, lng: number) => call<void>('dev_set_demo_building', { p_lat: lat, p_lng: lng }),
  replayCheckin: (userId: string) => call<void>('dev_replay_checkin', { p_user: userId }),
  replayExplanation: (text: string) => call<void>('dev_replay_explanation', { p_text: text }),
  replayPayForfeit: () => call<void>('dev_replay_pay_forfeit'),
  detectSkips: () => call<number>('detect_skips'),
  ensureOccurrences: (from: string, days = 1) => call<number>('ensure_occurrences', { p_from: from, p_days: days }),
};
