// The in-class lock. While one of my classes is open (or late) and I have not posted, the app is
// for posting, not browsing: every screen outside the allow list is replaced by the blocker
// (components/LockScreen.tsx). The moment I post, excuse myself, or the window closes, it lifts.
import { useMemo } from 'react';
import { useToday } from './appState';
import type { Phase } from './phase';
import type { Occurrence } from './types';

export interface InClassLock {
  occurrence: Occurrence;
  phase: 'open' | 'late';
}

/** Routes that stay reachable while locked: the camera, the demo panel, auth, add links. */
const ALLOWED = ['/post/', '/explain/', '/dev', '/sign-in', '/sign-up', '/add/'];

export function lockAllows(pathname: string): boolean {
  return ALLOWED.some((p) => (p.endsWith('/') ? pathname.startsWith(p) : pathname === p || pathname.startsWith(p + '/')));
}

const LOCKING: Phase[] = ['open', 'late'];

export function useInClassLock(nowMs: number): InClassLock | null {
  const { mine } = useToday(nowMs);
  return useMemo(() => {
    const open = mine.find((m) => m.phase === 'open') ?? mine.find((m) => m.phase === 'late');
    return open && LOCKING.includes(open.phase) ? { occurrence: open.occurrence, phase: open.phase as 'open' | 'late' } : null;
  }, [mine]);
}
