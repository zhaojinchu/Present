// Emoji reaction pills. Only reactions with a count show until "+" expands the set. Mine are ember.
import { useMemo, useState } from 'react';
import { IoAdd } from 'react-icons/io5';
import { toggleReaction } from '@/lib/api/social';
import { useInvalidateState } from '@/lib/appState';
import { REACTION_EMOJI } from '@/lib/config';
import type { Reaction } from '@/lib/types';
import { cx, Icon } from '@/ui';

export function ReactionBar({ eventId, reactions, meId, className }: { eventId: string; reactions: Reaction[]; meId: string | null; className?: string }) {
  const invalidate = useInvalidateState();
  const [expanded, setExpanded] = useState(false);
  const [override, setOverride] = useState<Record<string, boolean>>({});

  const rows = useMemo(
    () =>
      REACTION_EMOJI.map((emoji) => {
        const serverMine = reactions.some((r) => r.user_id === meId && r.emoji === emoji);
        const serverCount = reactions.filter((r) => r.emoji === emoji).length;
        const mine = override[emoji] ?? serverMine;
        const count = serverCount + (mine && !serverMine ? 1 : 0) - (!mine && serverMine ? 1 : 0);
        return { emoji, mine, count };
      }),
    [reactions, meId, override],
  );
  const visible = expanded ? rows : rows.filter((r) => r.count > 0);

  const onTap = async (emoji: string, mine: boolean) => {
    setOverride((o) => ({ ...o, [emoji]: !mine }));
    try {
      await toggleReaction(eventId, emoji);
      await invalidate();
    } catch {
      // revert below
    } finally {
      setOverride((o) => {
        const next = { ...o };
        delete next[emoji];
        return next;
      });
    }
  };

  return (
    <div className={cx('flex flex-wrap items-center gap-1.5', className)}>
      {visible.map((r) => (
        <button
          key={r.emoji}
          type="button"
          onClick={() => onTap(r.emoji, r.mine)}
          aria-pressed={r.mine}
          className={cx('pressable inline-flex items-center gap-1 h-[30px] rounded-full px-2.5', r.mine ? 'bg-ember-soft' : 'bg-surface-raised')}
        >
          <span className="text-[15px] leading-none">{r.emoji}</span>
          {r.count > 0 ? <span className={cx('text-caption font-semibold tabular', r.mine ? 'text-ember-deep' : 'text-text-secondary')}>{r.count}</span> : null}
        </button>
      ))}
      {!expanded ? (
        <button type="button" onClick={() => setExpanded(true)} aria-label="Add reaction" className="pressable inline-flex items-center justify-center h-[30px] w-[34px] rounded-full bg-surface-raised text-text-tertiary">
          <Icon icon={IoAdd} size={16} />
        </button>
      ) : null}
    </div>
  );
}
