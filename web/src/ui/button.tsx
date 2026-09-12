import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';
import { Icon, type IconType } from './icon';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive' | 'inverse';
type Size = 'sm' | 'md' | 'lg';

const variantClass: Record<ButtonVariant, string> = {
  // Black is the action. No coloured fills anywhere else (DESIGN.md §2).
  primary: 'bg-accent text-on-accent active:bg-accent-pressed',
  secondary: 'bg-surface-raised text-text active:bg-surface-overlay',
  tertiary: 'bg-transparent text-text-secondary active:bg-surface',
  destructive: 'bg-danger-soft text-danger',
  // White on the dark capture surfaces (camera preview bar).
  inverse: 'bg-capture-text text-capture-bg',
};

const sizeClass: Record<Size, string> = {
  sm: 'h-[var(--button-sm)] px-3 text-subhead font-semibold rounded-md',
  md: 'h-[var(--button-md)] px-4 text-headline rounded-md',
  lg: 'h-[var(--button-lg)] px-4 text-headline rounded-md',
};

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  title: string;
  variant?: ButtonVariant;
  size?: Size;
  icon?: IconType;
  loading?: boolean;
  /** Stretch to the container width (default for lg). */
  block?: boolean;
}

export function Button({ title, variant = 'primary', size = 'md', icon, loading, block, className, disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'pressable inline-flex items-center justify-center gap-1.5 select-none whitespace-nowrap disabled:opacity-40',
        variantClass[variant],
        sizeClass[size],
        (block ?? size === 'lg') && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner /> : icon ? <Icon icon={icon} size={size === 'sm' ? 16 : 18} /> : null}
      <span>{title}</span>
    </button>
  );
}

/** 44px circular icon button (nav bars, camera overlay). */
export function IconButton({
  icon,
  label,
  size = 44,
  iconSize = 24,
  tone = 'raised',
  className,
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  icon: IconType;
  label: string;
  size?: number;
  iconSize?: number;
  tone?: 'raised' | 'plain' | 'scrim';
}) {
  const toneClass = { raised: 'bg-surface-raised text-text', plain: 'bg-transparent text-text', scrim: 'bg-scrim text-capture-text' }[tone];
  return (
    <button
      type="button"
      aria-label={label}
      className={cx('pressable inline-flex items-center justify-center rounded-full shrink-0 disabled:opacity-40', toneClass, className)}
      style={{ width: size, height: size }}
      {...rest}
    >
      <Icon icon={icon} size={iconSize} />
    </button>
  );
}

export function Spinner({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cx('inline-block animate-spin rounded-full border-2 border-current border-r-transparent', className)}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  );
}

/** A row of stacked full-width actions (panels, sheets). */
export function ButtonStack({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('flex flex-col gap-2 w-full', className)}>{children}</div>;
}
