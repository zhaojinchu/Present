// Build-time configuration and product constants. Public values only; anything secret never
// enters the web bundle.

export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
  /** Serve the fixture in src/mock/state.ts through every hook; no backend needed. */
  mockState: import.meta.env.VITE_MOCK_STATE === '1',
  /** Show the demo controls (5 taps on your avatar). */
  devPanel: import.meta.env.VITE_DEV_PANEL !== '0',
  /** Public origin used for share links; falls back to the current origin. */
  appUrl: import.meta.env.VITE_APP_URL ?? '',
} as const;

export const supabaseConfigured = env.supabaseUrl.startsWith('http') && env.supabaseAnonKey.length > 20;

/**
 * Window rules. The database is the source of truth (ensure_occurrences writes opens_at,
 * on_time_until and deadline); these mirror it for countdown copy only.
 */
export const WINDOW = {
  opensBeforeMin: 2,
  onTimeAfterStartMin: 10,
  deadlineAfterEndMin: 10,
} as const;

export const REACTION_EMOJI = ['🔥', '😂', '🫡', '💀', '🧋'] as const;
export type ReactionEmoji = (typeof REACTION_EMOJI)[number];

export const CAPTION_MAX = 100;
export const COMMENT_MAX = 200;
export const EXPLANATION_MAX = 140;

/** State refresh cadence (ms). Realtime invalidates sooner; this is the safety net. */
export const STATE_POLL_MS = 5000;
export const STATE_POLL_DEGRADED_MS = 2000;

export const PHOTO_BUCKET = 'checkin-photos';

export function shareUrlFor(username: string): string {
  const origin = env.appUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${origin}/add/${encodeURIComponent(username)}`;
}
