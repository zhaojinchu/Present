import type { Occurrence } from './types';

// Web build of lib/notifications.ts. Metro picks this file for the web platform.
// Browsers cannot schedule local notifications the way iOS and Android do, and the
// hosted web app is the judge-facing demo, so every entry point is a no-op here.
// The "starts in 5 min" and "you missed X" moments are still visible on the Home
// screen and in the feed; only the OS banner is missing.

export function configureNotifications(): void {}

export async function ensureNotificationPermission(): Promise<boolean> {
  return false;
}

export async function rescheduleLocalNotifications(_todays: Occurrence[], _meId: string): Promise<void> {}

export function useNotificationRouting(): void {}
