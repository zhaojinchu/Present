import { UI_PREVIEW } from '../config';
import {
  previewEndWindowNow,
  previewReplayCheckin,
  previewReplayExplanation,
  previewReplayPayForfeit,
  previewReset,
  previewSetDemoBuilding,
  previewStartClassNow,
} from '../preview';
import { supabase } from '../supabase';

async function call<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
}

export const dev = {
  startClassNow: (course: string, windowMin = 3, skipAfterMin = 3) =>
    UI_PREVIEW
      ? Promise.resolve(previewStartClassNow(course, windowMin, skipAfterMin))
      : call<number>('dev_start_class_now', { p_course: course, p_window_min: windowMin, p_skip_after_min: skipAfterMin }),
  endWindowNow: () => (UI_PREVIEW ? Promise.resolve(previewEndWindowNow()) : call<number>('dev_end_window_now')),
  resetDemo: () => (UI_PREVIEW ? Promise.resolve(previewReset()) : call<number>('dev_reset_demo')),
  setDemoBuilding: (lat: number, lng: number) =>
    UI_PREVIEW ? Promise.resolve(previewSetDemoBuilding(lat, lng)) : call<void>('dev_set_demo_building', { p_lat: lat, p_lng: lng }),
  replayCheckin: (userId: string) =>
    UI_PREVIEW ? Promise.resolve(previewReplayCheckin(userId)) : call<void>('dev_replay_checkin', { p_user: userId }),
  replayExplanation: (text: string) =>
    UI_PREVIEW ? Promise.resolve(previewReplayExplanation(text)) : call<void>('dev_replay_explanation', { p_text: text }),
  replayPayForfeit: () => (UI_PREVIEW ? Promise.resolve(previewReplayPayForfeit()) : call<void>('dev_replay_pay_forfeit')),
  detectSkips: () => (UI_PREVIEW ? Promise.resolve(0) : call<number>('detect_skips')),
  ensureOccurrences: (from: string, days = 1) =>
    UI_PREVIEW ? Promise.resolve(0) : call<number>('ensure_occurrences', { p_from: from, p_days: days }),
};
