// Providers live in main.tsx. This layout owns the session and onboarding gates, the realtime
// subscription, the pending add-link, the "explain yourself" prompt, and the animated outlet.
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { StackTransition } from '@/app/StackTransition';
import { sendFriendRequest } from '@/lib/api/social';
import { useAppState, useRealtimeInvalidation, useSession } from '@/lib/appState';
import { env } from '@/lib/config';
import { prefs } from '@/lib/prefs';
import { syncPushSubscription } from '@/lib/push';
import { Spinner, useToast } from '@/ui';

const PUBLIC = new Set(['/sign-in', '/sign-up']);
const ONBOARDING_OK = ['/schedule', '/friends', '/settings', '/dev', '/add/'];

export default function RootLayout() {
  const { userId, loading } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  useRealtimeInvalidation(userId);
  const q = useAppState(!!userId);

  // Session gate.
  useEffect(() => {
    if (loading) return;
    const isPublic = PUBLIC.has(location.pathname);
    const isAddLink = location.pathname.startsWith('/add/');
    if (!userId && !isPublic && !isAddLink) navigate('/sign-in', { replace: true });
    if (userId && isPublic) navigate('/', { replace: true });
  }, [loading, userId, location.pathname, navigate]);

  // A browser that already allowed notifications re-attaches its subscription to this account.
  useEffect(() => {
    if (userId) void syncPushSubscription();
  }, [userId]);

  // Onboarding gate: no classes and not skipped -> schedule first.
  const classCount = q.data?.me.class_count ?? null;
  useEffect(() => {
    if (!userId || classCount === null) return;
    if (classCount > 0 || prefs.get('skip_schedule')) return;
    if (ONBOARDING_OK.some((p) => location.pathname.startsWith(p))) return;
    navigate('/schedule/import?onboarding=1', { replace: true });
  }, [userId, classCount, location.pathname, navigate]);

  // A link opened while signed out: send the request once the account exists.
  const sentPending = useRef(false);
  useEffect(() => {
    const pending = prefs.get('pending_add');
    if (!userId || !q.data || !pending || sentPending.current) return;
    sentPending.current = true;
    void sendFriendRequest(pending)
      .then((r) => {
        toast(r === 'friends' ? `You and @${pending} are friends` : `Request sent to @${pending}`);
        void q.refetch();
      })
      .catch(() => toast(`Could not add @${pending}`))
      .finally(() => prefs.set('pending_add', undefined));
  }, [userId, q.data, q, toast]);

  // A new unexplained miss opens the explain prompt once per session, except while posting.
  const prompted = useRef(new Set<string>());
  const firstMiss = q.data?.my_unexplained_misses[0]?.id ?? null;
  useEffect(() => {
    if (!firstMiss || prompted.current.has(firstMiss) || env.mockState) return; // fixture: reach /explain by hand
    if (location.pathname.startsWith('/post/') || location.pathname.startsWith('/explain/')) return;
    prompted.current.add(firstMiss);
    navigate(`/explain/${firstMiss}`);
  }, [firstMiss, location.pathname, navigate]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner size={24} className="text-text-tertiary" />
      </div>
    );
  }
  return (
    <div className="relative flex-1 min-h-0">
      <StackTransition />
    </div>
  );
}
