// A nudge aimed at me: a banner over the top of whatever screen I am on, with the countdown and
// the way into the camera. Disappears when I post, when the window closes, or when I dismiss it.
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { IoCameraOutline, IoClose } from 'react-icons/io5';
import { useLocation, useNavigate } from 'react-router';
import { useAppState } from '@/lib/appState';
import { useNow } from '@/lib/clock';
import { nudgesForMe } from '@/lib/presence';
import { fmtCountdown } from '@/lib/time';
import { Avatar, Button, Icon, Strong, Txt } from '@/ui';

export function NudgeBanner() {
  const q = useAppState();
  const now = useNow(1000);
  const navigate = useNavigate();
  const location = useLocation();
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const buzzed = useRef(new Set<string>());

  const state = q.data;
  const current = useMemo(() => {
    if (!state) return null;
    const mine = new Map(state.today_occurrences.filter((o) => o.user_id === state.me.id).map((o) => [o.id, o]));
    for (const e of nudgesForMe(state.feed, state.me.id, now)) {
      if (dismissed.has(e.id) || !e.occurrence_id) continue;
      const o = mine.get(e.occurrence_id);
      if (!o || o.status !== 'pending') continue;
      const deadline = Date.parse(o.deadline);
      const onTime = Date.parse(o.on_time_until);
      if (now > deadline) continue;
      return { event: e, occurrence: o, closesIn: (now < onTime ? onTime : deadline) - now, late: now >= onTime };
    }
    return null;
  }, [state, now, dismissed]);

  // One buzz per nudge, when it first appears.
  useEffect(() => {
    if (!current || buzzed.current.has(current.event.id)) return;
    buzzed.current.add(current.event.id);
    try {
      navigator.vibrate?.([40, 60, 40]);
    } catch {
      // not supported
    }
  }, [current]);

  const hidden = !current || location.pathname.startsWith('/post/');
  return (
    <AnimatePresence>
      {!hidden && current ? (
        <motion.div
          key={current.event.id}
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 36 }}
          className="fixed inset-x-0 top-0 z-50 safe-top px-3 pointer-events-none"
          role="status"
        >
          <div className="pointer-events-auto mt-2 mx-auto max-w-[406px] flex items-center gap-3 rounded-lg bg-text text-text-inverse px-3 py-2.5">
            <Avatar name={current.event.payload.display_name ?? '?'} src={current.event.payload.avatar_url} size={32} />
            <div className="flex-1 min-w-0">
              <Txt variant="subhead" tone="inverse" lines={1}>
                <Strong className="text-text-inverse">{current.event.payload.display_name}</Strong> nudged you
              </Txt>
              <Txt variant="footnote" tone="inverse" tabular lines={1} className="opacity-75">
                {current.occurrence.course_code} · {current.late ? 'late until' : 'on time for'} {fmtCountdown(current.closesIn)}
              </Txt>
            </div>
            <Button title="Post" variant="inverse" size="sm" icon={IoCameraOutline} onClick={() => navigate(`/post/${current.occurrence.id}`)} />
            <button type="button" aria-label="Dismiss" className="pressable w-8 h-8 -mr-1 inline-flex items-center justify-center rounded-full" onClick={() => setDismissed((d) => new Set(d).add(current.event.id))}>
              <Icon icon={IoClose} size={18} className="text-text-inverse opacity-75" />
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
