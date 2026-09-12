import { useRootNavigationState, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useCircleState } from '@/lib/circleState';
import { ensureNotificationPermission, rescheduleLocalNotifications, useNotificationRouting } from '@/lib/notifications';

/** App-wide side effects. Rendered once, inside the providers, next to the root Stack. */
export function AppEffects() {
  useNotificationRouting();
  useLocalNotificationSync();
  useExplainPrompt();
  return null;
}

// Whenever my pending classes for today change (new day, dev "start class now", a check-in,
// an excuse), rebuild the local "starts in 5 min" / "you missed X" notifications.
function useLocalNotificationSync() {
  const { state } = useCircleState();
  const me = state?.me ?? null;
  const today = state?.today;
  const sig = state
    ? state.today
        .filter((o) => o.user_id === state.me)
        .map((o) => `${o.id}:${o.status}:${o.skip_deadline}`)
        .join('|')
    : '';
  useEffect(() => {
    if (!me || !today) return;
    let cancelled = false;
    ensureNotificationPermission().then((ok) => {
      if (ok && !cancelled) rescheduleLocalNotifications(today, me);
    });
    return () => {
      cancelled = true;
    };
    // `sig` captures everything in `today` that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, me]);
}

// The skipper's phone opens the explain-yourself modal as soon as the state (via realtime
// or the poll) shows a skip of theirs with no explanation. Once per skip per app session.
function useExplainPrompt() {
  const { state } = useCircleState();
  const router = useRouter();
  const nav = useRootNavigationState();
  const ready = Boolean(nav?.key);
  const shown = useRef(new Set<string>());
  const id = state?.my_unexplained_skips[0]?.id ?? null;
  useEffect(() => {
    if (!ready || !id || shown.current.has(id)) return;
    shown.current.add(id);
    router.push(`/explain/${id}`);
  }, [ready, id, router]);
}
