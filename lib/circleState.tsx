import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { setServerTime } from './clock';
import { FEED_POLL_DEGRADED_MS, FEED_POLL_MS, UI_PREVIEW } from './config';
import { getPreviewState, isPreviewSignedIn, subscribePreview } from './preview';
import { useSession } from './session';
import { supabase } from './supabase';
import { todayKey } from './time';
import { normalizeState, type CircleState, type FeedEvent, type Reaction } from './types';

interface CircleStateCtx {
  state: CircleState | null;
  loading: boolean;
  /** true while the realtime channel is SUBSCRIBED */
  live: boolean;
  error: string | null;
  lastFetchedAt: number | null;
  /** Re-fetch everything. `maintain` also runs ensure_occurrences + detect_skips first. */
  refresh(opts?: { maintain?: boolean }): Promise<CircleState | null>;
}

const Ctx = createContext<CircleStateCtx | null>(null);

function PreviewCircleStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CircleState | null>(() => (isPreviewSignedIn() ? getPreviewState() : null));
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(() => Date.now());

  useEffect(() => {
    return subscribePreview(() => {
      if (!isPreviewSignedIn()) {
        setState(null);
        return;
      }
      const next = getPreviewState();
      setServerTime(next.server_time);
      setState(next);
      setLastFetchedAt(Date.now());
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!isPreviewSignedIn()) {
      setState(null);
      return null;
    }
    const next = getPreviewState();
    setServerTime(next.server_time);
    setState(next);
    setLastFetchedAt(Date.now());
    return next;
  }, []);

  const value = useMemo<CircleStateCtx>(
    () => ({ state, loading: false, live: true, error: null, lastFetchedAt, refresh }),
    [state, lastFetchedAt, refresh],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function CircleStateProvider({ children }: { children: React.ReactNode }) {
  if (UI_PREVIEW) return <PreviewCircleStateProvider>{children}</PreviewCircleStateProvider>;
  return <LiveCircleStateProvider>{children}</LiveCircleStateProvider>;
}

function LiveCircleStateProvider({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  const userId = session?.user.id ?? null;
  const accessToken = session?.access_token ?? null;

  const [state, setState] = useState<CircleState | null>(null);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
  const inflight = useRef<Promise<CircleState | null> | null>(null);

  const refresh = useCallback(
    async (opts?: { maintain?: boolean }) => {
      if (!userId) {
        setState(null);
        setLoading(false);
        return null;
      }
      if (opts?.maintain) {
        // Both are idempotent server-side; failures here must never block the state fetch.
        await Promise.allSettled([
          supabase.rpc('ensure_occurrences', { p_from: todayKey(), p_days: 1 }),
          supabase.rpc('detect_skips'),
        ]);
      }
      // A fetch that started before the caller's write committed would hand back stale state
      // (e.g. "no circle yet" right after create_circle), so wait for it, then fetch fresh.
      if (inflight.current) {
        try {
          await inflight.current;
        } catch {
          // ignore; we are about to refetch anyway
        }
      }
      const p = (async () => {
        const { data, error: err } = await supabase.rpc('get_circle_state');
        if (err) {
          setError(err.message);
          return null;
        }
        const s = normalizeState(data);
        setServerTime(s.server_time);
        setState(s);
        setError(null);
        setLastFetchedAt(Date.now());
        return s;
      })().finally(() => {
        if (inflight.current === p) inflight.current = null;
        setLoading(false);
      });
      inflight.current = p;
      return p;
    },
    [userId],
  );

  // Initial load + every foreground.
  useEffect(() => {
    refresh({ maintain: true });
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') refresh({ maintain: true });
    });
    return () => sub.remove();
  }, [refresh]);

  // Always-on poll. Realtime makes it feel instant; this makes it survive.
  useEffect(() => {
    if (!userId) return;
    const ms = live ? FEED_POLL_MS : FEED_POLL_DEGRADED_MS;
    const id = setInterval(() => {
      if (AppState.currentState === 'active') refresh();
    }, ms);
    return () => clearInterval(id);
  }, [userId, live, refresh]);

  // Realtime: one channel per circle, INSERT only, subscribed only once the session exists.
  const circleId = state?.circle?.id ?? null;
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!accessToken || !circleId) {
      setLive(false);
      return;
    }
    const scheduleRefresh = () => {
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = setTimeout(() => refresh(), 300);
    };
    const ch = supabase
      .channel(`feed:${circleId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'feed_events', filter: `circle_id=eq.${circleId}` },
        (payload) => {
          const row = payload.new as FeedEvent;
          setState((prev) => {
            if (!prev || prev.feed.some((e) => e.id === row.id)) return prev;
            return { ...prev, feed: [row, ...prev.feed] };
          });
          scheduleRefresh();
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reactions', filter: `circle_id=eq.${circleId}` },
        (payload) => {
          const r = payload.new as Reaction;
          setState((prev) => {
            if (!prev) return prev;
            const dup = prev.reactions.some(
              (x) => x.feed_event_id === r.feed_event_id && x.user_id === r.user_id && x.emoji === r.emoji,
            );
            if (dup) return prev;
            return {
              ...prev,
              reactions: [...prev.reactions, { feed_event_id: r.feed_event_id, user_id: r.user_id, emoji: r.emoji }],
            };
          });
        },
      )
      .subscribe((status) => setLive(status === 'SUBSCRIBED'));
    return () => {
      supabase.removeChannel(ch);
      setLive(false);
    };
  }, [accessToken, circleId, refresh]);

  const value = useMemo<CircleStateCtx>(
    () => ({ state, loading, live, error, lastFetchedAt, refresh }),
    [state, loading, live, error, lastFetchedAt, refresh],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCircleState(): CircleStateCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useCircleState outside CircleStateProvider');
  return v;
}
