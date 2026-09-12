// Ionicons (react-icons/io5), the set DESIGN.md specifies. Outline when inactive, filled when active.
import type { IconType } from 'react-icons';
import { cx } from './cx';

export type { IconType };

export function Icon({ icon: I, size = 20, className, label }: { icon: IconType; size?: 16 | 20 | 24 | number; className?: string; label?: string }) {
  return <I size={size} className={cx('shrink-0', className)} aria-hidden={label ? undefined : true} aria-label={label} />;
}

export type DiscTone = 'neutral' | 'accent' | 'success' | 'danger' | 'warning' | 'info' | 'ember';

const discClass: Record<DiscTone, string> = {
  neutral: 'bg-surface-raised text-text-secondary',
  accent: 'bg-accent-soft text-accent',
  success: 'bg-success-soft text-success',
  danger: 'bg-danger-soft text-danger',
  warning: 'bg-warning-soft text-warning',
  info: 'bg-info-soft text-info',
  ember: 'bg-ember-soft text-ember-deep',
};

/** Icon inside a tinted disc. Replaces every emoji in panels and empty states. */
export function IconBadge({ icon, tone = 'neutral', size = 40, className }: { icon: IconType; tone?: DiscTone; size?: number; className?: string }) {
  return (
    <span className={cx('inline-flex items-center justify-center rounded-full shrink-0', discClass[tone], className)} style={{ width: size, height: size }}>
      <Icon icon={icon} size={Math.round(size * 0.5)} />
    </span>
  );
}
