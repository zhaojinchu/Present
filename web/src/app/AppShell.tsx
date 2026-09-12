// The app chrome: safe-area header, one scrolling main, bottom tab bar. Screens render inside it.
import type { ReactNode } from 'react';
import { IoHome, IoHomeOutline, IoPerson, IoPersonOutline, IoToday, IoTodayOutline } from 'react-icons/io5';
import { NavLink, useLocation } from 'react-router';
import { useInvalidateState } from '@/lib/appState';
import { cx, Icon, Txt, type IconType } from '@/ui';

export function Header({ title, left, right, large, className }: { title?: ReactNode; left?: ReactNode; right?: ReactNode; large?: boolean; className?: string }) {
  return (
    <header className={cx('safe-top shrink-0 bg-bg', className)}>
      <div className={cx('flex items-center px-4', large ? 'h-auto pt-3 pb-1' : 'h-[var(--header)]')}>
        {left ? <div className="flex items-center min-w-11">{left}</div> : null}
        <div className={cx('flex-1 min-w-0', !left && !large && 'text-center')}>
          {typeof title === 'string' ? (
            <Txt variant={large ? 'largeTitle' : 'headline'} lines={1} as="h1">
              {title}
            </Txt>
          ) : (
            title
          )}
        </div>
        {right ? <div className="flex items-center justify-end min-w-11 gap-1">{right}</div> : null}
      </div>
    </header>
  );
}

/** One scrolling region per screen. `padded` adds the 16px gutter. */
export function Main({ children, padded = true, className }: { children: ReactNode; padded?: boolean; className?: string }) {
  return <main className={cx('scroll-main', padded && 'px-4', className)}>{children}</main>;
}

const TABS: { to: string; label: string; icon: IconType; active: IconType }[] = [
  { to: '/', label: 'Feed', icon: IoHomeOutline, active: IoHome },
  { to: '/today', label: 'Today', icon: IoTodayOutline, active: IoToday },
  { to: '/you', label: 'You', icon: IoPersonOutline, active: IoPerson },
];

export function TabBar() {
  const { pathname } = useLocation();
  const invalidate = useInvalidateState();
  return (
    <nav className="safe-bottom shrink-0 bg-bg" aria-label="Primary">
      <div className="hairline" />
      <div className="flex h-[var(--tabbar)]">
        {TABS.map((t) => {
          const on = t.to === '/' ? pathname === '/' : pathname.startsWith(t.to);
          return (
            <NavLink
              key={t.to}
              to={t.to}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 select-none"
              onClick={(e) => {
                // Re-tapping the active tab scrolls its main to the top (the iOS convention; also our "refresh").
                if (on) {
                  e.preventDefault();
                  document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
                  void invalidate();
                }
              }}
            >
              <Icon icon={on ? t.active : t.icon} size={24} className={on ? 'text-text' : 'text-text-tertiary'} />
              <span className={cx('text-[10px] leading-3 font-semibold', on ? 'text-text' : 'text-text-tertiary')}>{t.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

/** Full-height screen wrapper. Tabs screens pass `tabs`; pushed screens do not. */
export function Screen({ children, tabs, className }: { children: ReactNode; tabs?: boolean; className?: string }) {
  return (
    <div className={cx('flex flex-col h-full min-h-0 bg-bg', className)}>
      {children}
      {tabs ? <TabBar /> : null}
    </div>
  );
}
