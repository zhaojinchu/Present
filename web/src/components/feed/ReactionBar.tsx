// Reactions: whatever emoji people chose, as pills with counts (mine in ember), plus one button
// that opens the keyboard so you can pick any emoji you like. No preset row.
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { IoHappyOutline } from 'react-icons/io5';
import { toggleReaction } from '@/lib/api/social';
import { useInvalidateState } from '@/lib/appState';
import { haptic } from '@/lib/haptics';
import type { Reaction } from '@/lib/types';
import { cx, Icon } from '@/ui';

const MAX_CODE_POINTS = 8; // the server accepts up to 8

/** The first emoji in what was typed, or null (letters, digits and punctuation are not reactions). */
export function firstEmoji(text: string): string | null {
  const graphemes = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].map((s) => s.segment) : [...text];
  for (const g of graphemes) {
    if (/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(g) && [...g].length <= MAX_CODE_POINTS) return g;
  }
  return null;
}

export function ReactionBar({ eventId, reactions, meId, className }: { eventId: string; reactions: Reaction[]; meId: string | null; className?: string }) {
  const invalidate = useInvalidateState();
  const [picking, setPicking] = useState(false);
  const [override, setOverride] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (picking) inputRef.current?.focus();
  }, [picking]);

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

  const onType = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = firstEmoji(e.target.value);
    e.target.value = '';
    if (!picked) return;
    setPicking(false);
    void toggle(picked, rows.some((r) => r.emoji === picked && r.mine));
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape' || e.key === 'Enter') setPicking(false);
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
      {picking ? (
        <input
          ref={inputRef}
          type="text"
          inputMode="text"
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="done"
          placeholder="Any emoji"
          aria-label="Type an emoji to react"
          onChange={onType}
          onKeyDown={onKey}
          onBlur={() => setPicking(false)}
          className="h-[30px] w-[118px] rounded-full bg-surface-raised px-3 text-[16px] leading-none text-text placeholder:text-text-tertiary outline-none"
        />
      ) : (
        <button type="button" onClick={() => setPicking(true)} aria-label="React with any emoji" className="pressable inline-flex items-center justify-center h-[30px] w-[34px] rounded-full bg-surface-raised text-text-tertiary">
          <Icon icon={IoHappyOutline} size={17} />
        </button>
      )}
    </div>
  );
}
