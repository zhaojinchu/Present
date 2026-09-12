// The one read path. get_state() through TanStack Query, refreshed by a poll, on focus, and by
// realtime inserts; the mock fixture takes the same route when VITE_MOCK_STATE=1.
import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildMockState, MOCK_ME_ID } from '@/mock/state';
import { prefetchSignedUrls } from './api/post';
import { setServerTime } from './clock';
import { env, STATE_POLL_DEGRADED_MS, STATE_POLL_MS } from './config';
import { focusOccurrence, phaseOf } from './phase';
import { supabase } from './supabase';
import { AppState, type Occurrence } from './types';

export const STATE_KEY = ['state'] as const;

// ---------------------------------------------------------------- session

interface SessionState {
  session: Session | null;
  userId: string | null;
  loading: boolean;
}

const mockSession = { user: { id: MOCK_ME_ID } } as unknown as Session;

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>(() =>
    env.mockState ? { session: mockSession, userId: MOCK_ME_ID, loading: false } : { session: null, userId: null, loading: true },
  );
  useEffect(() => {
    if (env.mockState) return;
    let alive = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (alive) setState({ session: data.session, userId: data.session?.user.id ?? null, loading: false });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive) setState({ session, userId: session?.user.id ?? null, loading: false });
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return state;
}

// ---------------------------------------------------------------- state query

async function fetchState(): Promise<AppState> {
  if (env.mockState) {
    const s = buildMockState();
    setServerTime(s.server_time);
    return s;
  }
  const { data, error } = await supabase.rpc('get_state');
  if (error) throw error;
  const parsed = AppState.safeParse(data);
  if (!parsed.success) {
    console.error('[present] get_state shape mismatch', parsed.error.issues.slice(0, 5));
    throw new Error('The server sent something this version of the app does not understand.');
  }
  setServerTime(parsed.data.server_time);
  // Sign every photo the state mentions in one request so the cards render without waiting.
  const state = parsed.data;
  prefetchSignedUrls([
    ...state.feed.flatMap((e) => [e.payload.photo_path, e.payload.photo_back_path]),
    ...state.today_occurrences.flatMap((o) => [o.post?.photo_path, o.post?.photo_back_path]),
  ]);
  return state;
}

let live = true;
export function setLive(v: boolean) {
  live = v;
}

export function useAppState(enabled = true) {
  return useQuery({
    queryKey: STATE_KEY,
    queryFn: fetchState,
    enabled,
    refetchInterval: () => (live ? STATE_POLL_MS : STATE_POLL_DEGRADED_MS),
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
    staleTime: 1500,
    retry: 1,
  });
}

export function useInvalidateState() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: STATE_KEY });
}

/** One channel per user; RLS scopes what arrives, so no filter. Any insert refreshes the state. */
export function useRealtimeInvalidation(userId: string | null) {
  const qc = useQueryClient();
  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (!userId || env.mockState) return;
    const bump = () => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => qc.invalidateQueries({ queryKey: STATE_KEY }), 300);
    };
    const channel = supabase
      .channel(`me:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'feed_events' }, bump)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reactions' }, bump)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members' }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_forfeits' }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'miss_votes' }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'miss_vouches' }, bump)
      .subscribe((status) => setLive(status === 'SUBSCRIBED'));
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      void supabase.removeChannel(channel);
      setLive(false);
    };
  }, [userId, qc]);
}

// ---------------------------------------------------------------- derived views

export function useMe() {
  const q = useAppState();
  return q.data?.me ?? null;
}

export function useFriends() {
  const q = useAppState();
  return { friends: q.data?.friends ?? [], requests: q.data?.requests ?? { incoming: [], outgoing: [] } };
}

/** My occurrences today plus the focus one, with friends' occurrences for "in class now". */
export function useToday(nowMs: number) {
  const q = useAppState();
  const state = q.data;
  return useMemo(() => {
    const all = state?.today_occurrences ?? [];
    const meId = state?.me.id;
    const mine = all.filter((o) => o.user_id === meId);
    const theirs = all.filter((o) => o.user_id !== meId);
    const unexplained = new Set((state?.my_unexplained_misses ?? []).map((m) => m.occurrence_id));
    const focus = focusOccurrence(mine, nowMs, unexplained);
    const withPhase = (o: Occurrence) => ({ occurrence: o, phase: phaseOf(o, nowMs) });
    return {
      loading: q.isPending,
      mine: mine.map(withPhase),
      theirs: theirs.map(withPhase),
      focus: focus ? withPhase(focus) : null,
      unexplained,
    };
  }, [state, nowMs, q.isPending]);
}

export function useFeed() {
  const q = useAppState();
  const state = q.data;
  return useMemo(
    () => ({
      loading: q.isPending,
      error: q.error,
      events: state?.feed ?? [],
      reactions: state?.reactions ?? [],
      comments: state?.comments ?? [],
      me: state?.me ?? null,
    }),
    [state, q.isPending, q.error],
  );
}
