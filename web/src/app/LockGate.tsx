// Decides between the normal screen stack and the lock screen, and paints the app grey while
// locked (a class on the body so sheets in portals go grey too; the camera route stays in colour).
import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router';
import { LockScreen } from '@/components/LockScreen';
import { useNow } from '@/lib/clock';
import { lockAllows, useInClassLock } from '@/lib/lock';
import { StackTransition } from './StackTransition';

export function LockGate() {
  const now = useNow(5000);
  const lock = useInClassLock(now);
  const { pathname } = useLocation();
  const capture = pathname.startsWith('/post/');
  const grey = !!lock && !capture;
  useEffect(() => {
    document.body.classList.toggle('app-locked', grey);
    return () => document.body.classList.remove('app-locked');
  }, [grey]);
  // The stack must not re-render just because the clock ticked.
  const stack = useMemo(() => <StackTransition />, []);
  if (lock && !lockAllows(pathname)) return <LockScreen lock={lock} />;
  return stack;
}
