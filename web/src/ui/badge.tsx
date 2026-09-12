import { IoFlame, IoFlameOutline } from 'react-icons/io5';
import { cx } from './cx';
import { Icon, type IconType } from './icon';

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'danger' | 'warning' | 'info' | 'ember';

const badgeClass: Record<BadgeTone, string> = {
  neutral: 'bg-surface-raised text-text-secondary',
  accent: 'bg-accent-soft text-accent',
  success: 'bg-success-soft text-success',
  danger: 'bg-danger-soft text-danger',
  warning: 'bg-warning-soft text-warning',
  info: 'bg-info-soft text-info',
  ember: 'bg-ember-soft text-ember-deep',
};

/** Soft-tinted status badge. Sentence case, no border. Colour only on the changed thing. */
export function Badge({ label, tone = 'neutral', icon, className }: { label: string; tone?: BadgeTone; icon?: IconType; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-caption font-semibold whitespace-nowrap', badgeClass[tone], className)}>
      {icon ? <Icon icon={icon} size={12} /> : null}
      {label}
    </span>
  );
}

/** Selectable chip. Selected is inverted (black fill, white text) so no colour is needed. */
export function Chip({ label, selected, onClick, className }: { label: string; selected?: boolean; onClick?: () => void; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cx(
        'pressable inline-flex items-center h-9 rounded-full px-3.5 text-subhead font-semibold whitespace-nowrap',
        selected ? 'bg-text text-text-inverse' : 'bg-surface-raised text-text',
        className,
      )}
    >
      {label}
    </button>
  );
}

/** Streak count with a flame. Alive = ember; dead = outline flame, red number. */
export function StreakChip({ value, size = 'md', className }: { value: number; size?: 'sm' | 'md'; className?: string }) {
  const dead = value <= 0;
  return (
    <span
      className={cx(
        'inline-flex items-center gap-[3px] rounded-full bg-surface-raised font-bold tabular',
        size === 'sm' ? 'h-[22px] px-[7px] text-caption' : 'h-7 px-2.5 text-subhead',
        dead ? 'text-danger' : 'text-ember-deep',
        className,
      )}
    >
      <Icon icon={dead ? IoFlameOutline : IoFlame} size={size === 'sm' ? 12 : 14} />
      {value}
    </span>
  );
}
