// Reactions: whatever emoji people chose, as pills with counts (mine in ember), plus one button
// that opens the emoji board so you can pick any emoji you like. No preset row.
import { useMemo, useState } from 'react';
import { IoHappyOutline } from 'react-icons/io5';
import { toggleReaction } from '@/lib/api/social';
import { useAppState, useInvalidateState } from '@/lib/appState';
import { haptic } from '@/lib/haptics';
import type { Reaction } from '@/lib/types';
import { cx, Icon } from '@/ui';
import { EmojiSheet } from './EmojiSheet';

export function ReactionBar({ eventId, reactions, meId, className }: { eventId: string; reactions: Reaction[]; meId: string | null; className?: string }) {
  const invalidate = useInvalidateState();
  const state = useAppState();
  const [picking, setPicking] = useState(false);
  // Everything I have reacted with, anywhere in the feed: the picker's "frequently used".
  const history = useMemo(() => (state.data?.reactions ?? []).filter((r) => r.user_id === meId).map((r) => r.emoji), [state.data, meId]);
  const [override, setOverride] = useState<Record<string, boolean>>({});

  const rows = useMemo(() => {
    const map = new Map<string, { emoji: string; count: number; mine: boolean }>();
    for (const r of reactions) {
      const row = map.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false };
      row.count += 1;
      if (r.user_id === meId) row.mine = true;
      map.set(r.emoji, row);
    }
    for (const [emoji, mine] of Object.entries(override)) {
      const row = map.get(emoji) ?? { emoji, count: 0, mine: false };
      if (mine && !row.mine) {
        row.count += 1;
        row.mine = true;
      } else if (!mine && row.mine) {
        row.count -= 1;
        row.mine = false;
      }
      map.set(emoji, row);
    }
    return [...map.values()].filter((r) => r.count > 0).sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji));
  }, [reactions, meId, override]);

  const toggle = async (emoji: string, mine: boolean) => {
    setOverride((o) => ({ ...o, [emoji]: !mine }));
    try {
      haptic('light');
      await toggleReaction(eventId, emoji);
      await invalidate();
    } catch {
      // the override is dropped below, so the pill snaps back to the server's truth
    } finally {
      setOverride((o) => {
        const next = { ...o };
        delete next[emoji];
        return next;
      });
    }
  };

  const onPick = (emoji: string) => {
    setPicking(false);
    void toggle(emoji, rows.some((r) => r.emoji === emoji && r.mine));
  };

  return (
    <div className={cx('flex flex-wrap items-center gap-1.5', className)}>
      {rows.map((r) => (
        <button
          key={r.emoji}
          type="button"
          onClick={() => toggle(r.emoji, r.mine)}
          aria-pressed={r.mine}
          className={cx('pressable inline-flex items-center gap-1 h-[30px] rounded-full px-2.5', r.mine ? 'bg-ember-soft' : 'bg-surface-raised')}
        >
          <span className="text-[15px] leading-none">{r.emoji}</span>
          <span className={cx('text-caption font-semibold tabular', r.mine ? 'text-ember-deep' : 'text-text-secondary')}>{r.count}</span>
        </button>
      ))}
      <button type="button" onClick={() => setPicking(true)} aria-label="React with any emoji" className="pressable inline-flex items-center justify-center h-[30px] w-[34px] rounded-full bg-surface-raised text-text-tertiary">
        <Icon icon={IoHappyOutline} size={17} />
      </button>
      <EmojiSheet open={picking} onOpenChange={setPicking} onPick={onPick} history={history} />
    </div>
  );
}
