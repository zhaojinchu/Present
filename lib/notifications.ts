import * as Notifications from 'expo-notifications';
import { useRootNavigationState, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { UI_PREVIEW } from './config';
import type { Occurrence } from './types';

// Expo Go (SDK 53+) cannot receive remote push. Everything here is LOCAL scheduling,
// which still works. See PLAN.md §7.

let configured = false;

export function configureNotifications() {
  if (configured || UI_PREVIEW || Platform.OS === 'web') return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true, // banners while foregrounded: that is what the projector sees
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'Class reminders',
      importance: Notifications.AndroidImportance.HIGH,
    }).catch(() => {});
  }
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const cur = await Notifications.getPermissionsAsync();
    if (cur.granted) return true;
    const req = await Notifications.requestPermissionsAsync();
    return req.granted;
  } catch {
    return false;
  }
}

/**
 * Cancel everything and re-schedule for my pending classes today:
 *  - "starts in 5 min" at starts_at - 5 min (fires immediately if that was within the last minute,
 *    which is what the dev "start class now" button produces)
 *  - "you missed X" at skip_deadline
 * Called whenever today's occurrences change, so a check-in cancels the "missed" one.
 */
export async function rescheduleLocalNotifications(todays: Occurrence[], meId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    const nowMs = Date.now();
    for (const o of todays) {
      if (o.user_id !== meId || o.status !== 'pending') continue;
      const deadlineMs = new Date(o.skip_deadline).getTime();
      if (deadlineMs <= nowMs) continue;

      const startsMs = new Date(o.starts_at).getTime();
      const remindAt = startsMs - 5 * 60_000;
      if (remindAt > nowMs) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `${o.course_code} starts in 5 min`,
            body: 'Open Present and check in. Your circle is watching.',
            data: { route: `/checkin/${o.id}` },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(remindAt) },
        });
      } else if (startsMs > nowMs - 2 * 60_000) {
        // Started within the last two minutes: that is the dev "start class now" button. Fire now.
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `${o.course_code} is starting`,
            body: 'Check in now. Your circle is watching.',
            data: { route: `/checkin/${o.id}` },
          },
          trigger: null,
        });
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `You missed ${o.course_code}`,
          body: 'Explain yourself to your circle.',
          data: { route: `/explain/occ:${o.id}` },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(deadlineMs) },
      });
    }
  } catch (e) {
    console.warn('[present] notifications', e);
  }
}

/** Route to the screen named in a tapped notification's data.route. Mount once, in the root layout. */
export function useNotificationRouting() {
  const router = useRouter();
  const nav = useRootNavigationState();
  const ready = Boolean(nav?.key);
  const last = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);
  useEffect(() => {
    const id = last?.notification.request.identifier;
    if (!ready || !last || !id || handled.current === id) return;
    const route = (last.notification.request.content.data as { route?: unknown } | null)?.route;
    if (typeof route !== 'string') {
      handled.current = id;
      return;
    }
    try {
      router.push(route as never);
      handled.current = id; // only after a successful push, so a not-ready navigator retries next render
    } catch {
      // navigator not ready yet; the effect re-runs when `ready` flips
    }
  }, [ready, last, router]);
}
