// Route transitions and the two swipe gestures. Both are interactive: the screen follows the
// finger and, on release, commits (past a third of the width, or a flick) or springs back.
//   Tabs: a horizontal swipe on a tab screen moves to the neighbouring tab (Feed, Today, You); the
//   screens slide in that direction. A tab-bar tap still crossfades. Touches that start inside a
//   horizontal scroller or a [data-swipe-ignore] element are left alone, and a gesture that starts
//   vertical stays a scroll.
//   Pushed screens: a push slides the new screen in from the right while the old one recedes; a
//   pop slides the top screen out to the right. A drag from the left edge pops, the way iOS does.
import { AnimatePresence, animate, motion, motionValue, type MotionValue } from 'motion/react';
import { useRef, type TouchEvent } from 'react';
import { useLocation, useNavigate, useNavigationType, useOutlet } from 'react-router';

const TAB_ORDER = ['/', '/today', '/you'];
const TAB_PATHS = new Set(TAB_ORDER);
const EDGE_PX = 28;
const LOCK_PX = 8;
const COMMIT_FRACTION = 0.3; // of the screen width
const COMMIT_VELOCITY = 0.35; // px per ms
const SNAP = { type: 'spring', stiffness: 520, damping: 44, mass: 0.8 } as const;

type TabSwipeState = { tabSwipe?: number } | null;
type Custom = { tab: number; push: number; w: number };

interface Gesture {
  x: number;
  y: number;
  t: number;
  /** Last two samples, for the release velocity. */
  lastX: number;
  lastT: number;
  prevX: number;
  prevT: number;
  /** Pushed screens: started at the left edge. */
  edge: boolean;
  /** 'x' once the finger has clearly moved horizontally, 'y' once vertically, null until decided. */
  lock: 'x' | 'y' | null;
  /** Tab swipes ignore touches that began inside a horizontal scroller or an opted-out element. */
  ignore: boolean;
  /** Which way this gesture may commit: -1 previous, 1 next, 0 nowhere (still follows, with resistance). */
  allow: { left: boolean; right: boolean };
}

export function StackTransition() {
  const location = useLocation();
  const navigate = useNavigate();
  const navType = useNavigationType();
  const outlet = useOutlet();
  const hostRef = useRef<HTMLDivElement>(null);
  const isTab = TAB_PATHS.has(location.pathname);
  const capture = location.pathname.startsWith('/post/');
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const swipeDir = (location.state as TabSwipeState)?.tabSwipe ?? 0;
  const width = () => hostRef.current?.clientWidth || Math.min(430, window.innerWidth) || 390;
  // Both the entering and the exiting screen read this; w keeps every target in px so a screen
  // that was dragged continues from where the finger left it.
  const custom: Custom = { tab: swipeDir, push: navType === 'POP' ? -1 : 1, w: width() };
  const key = isTab ? `tab:${location.pathname}` : location.pathname;

  // One x per mounted screen, so the exiting one keeps animating while the next one enters.
  const xs = useRef(new Map<string, MotionValue<number>>());
  const xFor = (k: string) => {
    let v = xs.current.get(k);
    if (!v) {
      v = motionValue(0);
      xs.current.set(k, v);
    }
    return v;
  };
  const x = xFor(key);
  const gesture = useRef<Gesture | null>(null);

  const onTouchStart = (e: TouchEvent) => {
    if (capture) return;
    const t = e.touches[0];
    const target = e.target as Element | null;
    const i = TAB_ORDER.indexOf(location.pathname);
    gesture.current = {
      x: t.clientX,
      y: t.clientY,
      t: Date.now(),
      lastX: t.clientX,
      lastT: Date.now(),
      prevX: t.clientX,
      prevT: Date.now(),
      edge: t.clientX <= EDGE_PX,
      lock: null,
      ignore: !!target?.closest('[data-swipe-ignore], .overflow-x-auto, input, textarea, select'),
      allow: isTab ? { left: i >= 0 && i < TAB_ORDER.length - 1, right: i > 0 } : { left: false, right: true },
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
    if (g.lock !== 'x' || g.ignore) return;
    if (!isTab && !g.edge) return;
    g.prevX = g.lastX;
    g.prevT = g.lastT;
    g.lastX = t.clientX;
    g.lastT = Date.now();
    if (isTab) {
      const free = dx < 0 ? g.allow.left : g.allow.right;
      x.set(free ? dx : dx * 0.22);
    } else {
      x.set(Math.max(0, dx));
    }
  };

  const onTouchEnd = () => {
    const g = gesture.current;
    gesture.current = null;
    if (!g || g.lock !== 'x' || g.ignore || (!isTab && !g.edge)) {
      if (x.get() !== 0) animate(x, 0, SNAP);
      return;
    }
    const dx = g.lastX - g.x;
    const v = (g.lastX - g.prevX) / Math.max(1, g.lastT - g.prevT);
    const w = width();
    const far = Math.abs(dx) > w * COMMIT_FRACTION;
    const flick = Math.abs(v) > COMMIT_VELOCITY && Math.sign(v) === Math.sign(dx);
    if (isTab) {
      const free = dx < 0 ? g.allow.left : g.allow.right;
      if (free && (far || flick)) {
        const i = TAB_ORDER.indexOf(location.pathname);
        navigate(TAB_ORDER[dx < 0 ? i + 1 : i - 1], { state: { tabSwipe: dx < 0 ? 1 : -1 } });
        return;
      }
    } else if (dx > 0 && (far || flick)) {
      if (window.history.length > 1) navigate(-1);
      else navigate('/');
      return;
    }
    animate(x, 0, SNAP);
  };

  const tabVariants = {
    initial: ({ tab, w }: Custom) => (reduce ? { opacity: 0 } : tab ? { x: tab > 0 ? w : -w, opacity: 1 } : { opacity: 0 }),
    animate: { x: 0, opacity: 1, zIndex: 1 },
    exit: ({ tab, w }: Custom) => (reduce ? { opacity: 0 } : tab ? { x: tab > 0 ? -w : w, opacity: 1 } : { opacity: 0 }),
  };
  const pushVariants = {
    // Entering: from the right on a push; from slightly behind on a pop.
    initial: ({ push, w }: Custom) => (reduce ? { opacity: 0 } : push > 0 ? { x: w, opacity: 1, zIndex: 2 } : { x: -Math.round(w * 0.24), opacity: 0.85, zIndex: 0 }),
    animate: ({ push }: Custom) => ({ x: 0, opacity: 1, zIndex: push > 0 ? 2 : 0 }),
    // Exiting: recede on a push; slide out to the right on a pop (from wherever the finger left it).
    exit: ({ push, w }: Custom) => (reduce ? { opacity: 0 } : push > 0 ? { x: -Math.round(w * 0.24), opacity: 0.85, zIndex: 0 } : { x: w, opacity: 1, zIndex: 2 }),
  };

  return (
    <div ref={hostRef} className="absolute inset-0">
      <AnimatePresence
        mode="popLayout"
        initial={false}
        custom={custom}
        onExitComplete={() => {
          for (const k of [...xs.current.keys()]) if (k !== key) xs.current.delete(k);
        }}
      >
        <motion.div
          key={key}
          custom={custom}
          style={{ x }}
          className="absolute inset-0 flex flex-col bg-bg"
          variants={isTab ? tabVariants : pushVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={isTab && !swipeDir ? { duration: 0.16 } : { type: 'spring', stiffness: 520, damping: 46, mass: 0.8 }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
        >
          {outlet}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
