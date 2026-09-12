// Wrap any avatar or name: tapping it opens that person's profile (/u/:username), or the You tab
// when it is me. Stops propagation so it works inside cards that are tappable themselves.
import type { MouseEvent, ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useMe } from '@/lib/appState';
import { cx } from '@/ui';

export function ProfileLink({ username, children, className, label }: { username: string | null | undefined; children: ReactNode; className?: string; label?: string }) {
  const navigate = useNavigate();
  const me = useMe();
  const go = (e: MouseEvent) => {
    e.stopPropagation();
    if (!username) return;
    navigate(me?.username === username ? '/you' : `/u/${username}`);
  };
  if (!username) return <span className={className}>{children}</span>;
  return (
    <button type="button" onClick={go} className={cx('pressable text-left', className)} aria-label={label ?? `@${username}`}>
      {children}
    </button>
  );
}
