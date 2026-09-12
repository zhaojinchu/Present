// The app chrome: safe-area header, one scrolling main (with pull-to-refresh), bottom tab bar.
// Screens render inside it.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { IoHome, IoHomeOutline, IoPerson, IoPersonOutline, IoToday, IoTodayOutline } from 'react-icons/io5';
import { NavLink, useLocation } from 'react-router';
import { useInvalidateState } from '@/lib/appState';
import { haptic } from '@/lib/haptics';
import { cx, Icon, Spinner, Txt, type IconType } from '@/ui';

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

const PULL_THRESHOLD = 64; // px of pull that arms a refresh
const PULL_MAX = 110;
const HOLD = 56; // where the content rests while refreshing

/**
 * One scrolling region per screen. `padded` adds the 16px gutter. Pulling down from the top
 * refreshes the state (a tick when it arms, another when it fires); pass `refresh={false}` to
 * opt out on screens with their own gestures.
 */
export function Main({ children, padded = true, className, refresh = true }: { children: ReactNode; padded?: boolean; className?: string; refresh?: boolean }) {
  const mainRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const spinRef = useRef<HTMLDivElement>(null);
  const invalidate = useInvalidateState();
  const [refreshing, setRefreshing] = useState(false);
  const latest = useRef({ invalidate, refreshing });
  latest.current = { invalidate, refreshing };

  useEffect(() => {
    const main = mainRef.current;
    const body = bodyRef.current;
    const spin = spinRef.current;
    if (!refresh || !main || !body || !spin) return;
    let startY = 0;
    let pulling = false;
    let armed = false;
    let pull = 0;

    const draw = (y: number, animate: boolean) => {
      body.style.transition = animate ? 'transform 260ms cubic-bezier(.2,.8,.2,1)' : 'none';
      body.style.transform = y > 0 ? `translate3d(0, ${y}px, 0)` : '';
      const p = Math.min(1, y / PULL_THRESHOLD);
      spin.style.transition = animate ? 'opacity 200ms, transform 260ms cubic-bezier(.2,.8,.2,1)' : 'none';
      spin.style.opacity = String(p);
      spin.style.transform = `translate3d(0, ${Math.max(0, y - HOLD) / 2 + 12}px, 0) scale(${0.6 + 0.4 * p}) rotate(${p * 270}deg)`;
    };
    const onStart = (e: TouchEvent) => {
      if (latest.current.refreshing || main.scrollTop > 0 || e.touches.length !== 1) return;
      startY = e.touches[0].clientY;
      pulling = true;
      armed = false;
      pull = 0;
    };
    const onMove = (e: TouchEvent) => {
      if (!pulling) return;
      const dy = e.touches[0].clientY - startY;
      if (dy <= 0 || main.scrollTop > 0) {
        if (pull > 0) draw(0, false);
        pull = 0;
        return;
      }
      pull = Math.min(PULL_MAX, dy * 0.55);
      if (!armed && pull >= PULL_THRESHOLD) {
        armed = true;
        haptic('light');
      } else if (armed && pull < PULL_THRESHOLD) {
        armed = false;
      }
      draw(pull, false);
    };
    const onEnd = () => {
      if (!pulling) return;
      pulling = false;
      if (!armed) {
        draw(0, true);
        return;
      }
      armed = false;
      haptic('medium');
      setRefreshing(true);
      draw(HOLD, true);
      const started = Date.now();
      Promise.resolve(latest.current.invalidate())
        .catch(() => undefined)
        .then(() => new Promise((r) => setTimeout(r, Math.max(0, 500 - (Date.now() - started)))))
        .then(() => {
          draw(0, true);
          setRefreshing(false);
        });
    };
    main.addEventListener('touchstart', onStart, { passive: true });
    main.addEventListener('touchmove', onMove, { passive: true });
    main.addEventListener('touchend', onEnd, { passive: true });
    main.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      main.removeEventListener('touchstart', onStart);
      main.removeEventListener('touchmove', onMove);
      main.removeEventListener('touchend', onEnd);
      main.removeEventListener('touchcancel', onEnd);
    };
  }, [refresh]);

  return (
    <main ref={mainRef} className={cx('scroll-main relative', className)} aria-busy={refreshing || undefined}>
      {refresh ? (
        <div ref={spinRef} className="pointer-events-none absolute left-1/2 -ml-3 top-0 w-6 h-6 text-text-tertiary opacity-0" aria-hidden>
          <Spinner size={24} />
        </div>
      ) : null}
      <div ref={bodyRef} className={cx(padded && 'px-4')}>
        {children}
      </div>
    </main>
  );
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
                haptic('light');
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
