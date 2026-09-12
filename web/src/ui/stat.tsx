import type { ReactNode } from 'react';
import { cx } from './cx';
import { Icon, type IconType } from './icon';
import { Txt, type Tone, type TypeVariant } from './text';

/** Big tabular number with a tracked uppercase label under it (the Strava pattern). */
export function Stat({
  value,
  label,
  size = 'md',
  tone = 'primary',
  icon,
  iconClassName,
  align = 'start',
  className,
}: {
  value: ReactNode;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  tone?: Tone;
  icon?: IconType;
  /** The flame passes text-ember here so the number can stay primary. */
  iconClassName?: string;
  align?: 'start' | 'center' | 'end';
  className?: string;
}) {
  const variant: TypeVariant = size === 'lg' ? 'display' : size === 'md' ? 'stat' : 'title';
  const alignClass = { start: 'items-start', center: 'items-center', end: 'items-end' }[align];
  return (
    <div className={cx('flex flex-col', alignClass, className)}>
      <div className={cx('flex items-center', size === 'lg' ? 'gap-1.5' : 'gap-1')}>
        {icon ? <Icon icon={icon} size={size === 'lg' ? 30 : size === 'md' ? 20 : 16} className={iconClassName} /> : null}
        <Txt variant={variant} tone={tone} tabular>
          {value}
        </Txt>
      </div>
      <Txt variant="label" tone="tertiary" className="mt-0.5">
        {label}
      </Txt>
    </div>
  );
}
