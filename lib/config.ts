// Build-time flags. EXPO_PUBLIC_* vars are inlined by Expo at bundle time.
export const TZ = 'America/New_York';
export const PHOTO_BUCKET = 'checkin-photos';

export const DEV_PANEL = process.env.EXPO_PUBLIC_DEV_PANEL === '1';
export const REQUIRE_GEOFENCE_DEFAULT = process.env.EXPO_PUBLIC_REQUIRE_GEOFENCE !== '0';
export const DUAL_CAPTURE = process.env.EXPO_PUBLIC_DUAL_CAPTURE === '1';

export const FEED_POLL_MS = 5000; // always-on safety net; realtime is the accelerator
export const FEED_POLL_DEGRADED_MS = 2000; // when the realtime channel is not SUBSCRIBED

export const REACTION_EMOJI = ['🔥', '😂', '🫡', '💀', '🧋'] as const;

export const FORFEIT_PRESETS = [
  'buys the circle boba',
  'does the dishes',
  'posts a photo the circle picks',
  'cooks dinner for the circle',
] as const;

export const EXPLANATION_MAX = 140;

// Runtime-overridable (dev panel). Read through getters so screens see changes.
const runtime = { requireGeofence: REQUIRE_GEOFENCE_DEFAULT };
export function requireGeofence() {
  return runtime.requireGeofence;
}
export function setRequireGeofence(v: boolean) {
  runtime.requireGeofence = v;
}
