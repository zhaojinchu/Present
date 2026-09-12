// Route transitions and the two swipe gestures.
//   Tabs: a horizontal swipe on a tab screen moves to the neighbouring tab (Feed, Today, You) and the
//   screens slide in that direction; a tab-bar tap still crossfades. Touches that start inside a
//   horizontal scroller or a [data-swipe-ignore] element (the together deck) are left alone, and a
//   gesture that starts vertical stays a scroll.
//   Pushed screens: a push slides the new screen in from the right while the old one recedes; a pop
//   slides the top screen out to the right while the one beneath comes back. A swipe from the left
//   edge pops, the way iOS does.
import { AnimatePresence, motion } from 'motion/react';
import { useRef, type TouchEvent } from 'react';
import { useLocation, useNavigate, useNavigationType, useOutlet } from 'react-router';

const TAB_ORDER = ['/', '/today', '/you'];
const TAB_PATHS = new Set(TAB_ORDER);
const EDGE_PX = 28;
const SWIPE_PX = 72;
const TAB_SWIPE_PX = 64;
const LOCK_PX = 10;

type TabSwipeState = { tabSwipe?: number } | null;

interface Gesture {
  x: number;
  y: number;
  t: number;
  /** Pushed screens: started at the left edge. */
  edge: boolean;
  /** 'x' once the finger has clearly moved horizontally, 'y' once vertically, null until decided. */
  lock: 'x' | 'y' | null;
  /** Tab swipes ignore touches that began inside a horizontal scroller or an opted-out element. */
  ignore: boolean;
}

export function StackTransition() {
  const location = useLocation();
  const navigate = useNavigate();
  const outlet = useOutlet();
  const isTab = TAB_PATHS.has(location.pathname);
  const capture = location.pathname.startsWith('/post/');
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const swipeDir = (location.state as TabSwipeState)?.tabSwipe ?? 0;
  const navType = useNavigationType();
  // 1 = going deeper, -1 = coming back. Both the entering and the exiting screen read it.
  const custom = { tab: swipeDir, push: navType === 'POP' ? -1 : 1 };
  const gesture = useRef<Gesture | null>(null);

  const onTouchStart = (e: TouchEvent) => {
    if (capture) return;
    const t = e.touches[0];
    const target = e.target as Element | null;
    gesture.current = {
      x: t.clientX,
      y: t.clientY,
      t: Date.now(),
      edge: t.clientX <= EDGE_PX,
      lock: null,
      ignore: !!target?.closest('[data-swipe-ignore], .overflow-x-auto, input, textarea, select'),
    };
  };

  const onTouchMove = (e: TouchEvent) => {
    const g = gesture.current;
    if (!g) return;
    const t = e.touches[0];
    const dx = t.clientX - g.x;
    const dy = t.clientY - g.y;
    if (!g.lock && (Math.abs(dx) > LOCK_PX || Math.abs(dy) > LOCK_PX)) {
      g.lock = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
    }
    if (isTab) return; // tabs decide on touch end, so a slow drag can still be a scroll
    // Pushed screen: edge pop.
    if (g.edge && g.lock === 'x' && dx > SWIPE_PX) {
      gesture.current = null;
      if (window.history.length > 1) navigate(-1);
      else navigate('/');
    }
  };

  const onTouchEnd = (e: TouchEvent) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g || !isTab || g.ignore || g.lock !== 'x') return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - g.x;
    const dt = Math.max(1, Date.now() - g.t);
    const fast = Math.abs(dx) / dt > 0.45; // px per ms
    if (Math.abs(dx) < TAB_SWIPE_PX && !fast) return;
    const i = TAB_ORDER.indexOf(location.pathname);
    const next = dx < 0 ? i + 1 : i - 1;
    if (i < 0 || next < 0 || next >= TAB_ORDER.length) return;
    navigate(TAB_ORDER[next], { state: { tabSwipe: dx < 0 ? 1 : -1 } });
  };

  // Tab screens: crossfade on a tap, slide on a swipe (`custom` carries the direction to the
  // exiting screen as well). Pushed screens: the iOS push.
  type Custom = { tab: number; push: number };
  const tabVariants = {
    initial: ({ tab: dir }: Custom) => (reduce ? { opacity: 0 } : dir ? { x: dir > 0 ? '100%' : '-100%', opacity: 1 } : { opacity: 0 }),
    animate: { x: 0, opacity: 1, zIndex: 1 },
    exit: ({ tab: dir }: Custom) => (reduce ? { opacity: 0 } : dir ? { x: dir > 0 ? '-100%' : '100%', opacity: 1 } : { opacity: 0 }),
  };
  const pushVariants = {
    // Entering: from the right on a push; from slightly behind on a pop.
    initial: ({ push }: Custom) => (reduce ? { opacity: 0 } : push > 0 ? { x: '100%', opacity: 1, zIndex: 2 } : { x: '-24%', opacity: 0.85, zIndex: 0 }),
    animate: ({ push }: Custom) => ({ x: 0, opacity: 1, zIndex: push > 0 ? 2 : 0 }),
    // Exiting: recede on a push; slide out to the right on a pop.
    exit: ({ push }: Custom) => (reduce ? { opacity: 0 } : push > 0 ? { x: '-24%', opacity: 0.85, zIndex: 0 } : { x: '100%', opacity: 1, zIndex: 2 }),
  };

  return (
    <AnimatePresence mode="popLayout" initial={false} custom={custom}>
      <motion.div
        key={isTab ? `tab:${location.pathname}` : location.pathname}
        custom={custom}
        className="absolute inset-0 flex flex-col bg-bg"
        variants={isTab ? tabVariants : pushVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={
          isTab
            ? swipeDir && !reduce
              ? { type: 'spring', stiffness: 520, damping: 46, mass: 0.8 }
              : { duration: 0.16 }
            : { type: 'spring', stiffness: 480, damping: 44, mass: 0.8 }
        }
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={() => (gesture.current = null)}
      >
        {outlet}
      </motion.div>
    </AnimatePresence>
  );
}
