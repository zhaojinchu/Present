// The one text component and its small relatives. Screens never set font sizes or colours
// directly: variant + tone only (DESIGN.md §4).
import type { AriaRole, CSSProperties, ElementType, ReactNode } from 'react';
import { cx } from './cx';

export type TypeVariant = 'display' | 'stat' | 'largeTitle' | 'title' | 'headline' | 'body' | 'subhead' | 'footnote' | 'caption' | 'label';
export type Tone = 'primary' | 'secondary' | 'tertiary' | 'disabled' | 'accent' | 'ember' | 'success' | 'danger' | 'warning' | 'info' | 'inverse' | 'capture' | 'captureSecondary';

const variantClass: Record<TypeVariant, string> = {
  display: 'text-display tabular',
  stat: 'text-stat tabular',
  largeTitle: 'text-large-title',
  title: 'text-title',
  headline: 'text-headline',
  body: 'text-body',
  subhead: 'text-subhead',
  footnote: 'text-footnote',
  caption: 'text-caption',
  label: 'text-label uppercase',
};

export const toneClass: Record<Tone, string> = {
  primary: 'text-text',
  secondary: 'text-text-secondary',
  tertiary: 'text-text-tertiary',
  disabled: 'text-text-disabled',
  accent: 'text-accent',
  ember: 'text-ember-deep',
  success: 'text-success',
  danger: 'text-danger',
  warning: 'text-warning',
  info: 'text-info',
  inverse: 'text-text-inverse',
  capture: 'text-capture-text',
  captureSecondary: 'text-capture-text-secondary',
};

export interface TxtProps {
  variant?: TypeVariant;
  tone?: Tone;
  weight?: 400 | 600 | 700;
  align?: 'left' | 'center' | 'right';
  tabular?: boolean;
  /** Clamp to N lines with an ellipsis. */
  lines?: 1 | 2 | 3;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  id?: string;
  role?: AriaRole;
}

const weightClass = { 400: 'font-normal', 600: 'font-semibold', 700: 'font-bold' } as const;
const alignClass = { left: 'text-left', center: 'text-center', right: 'text-right' } as const;
const linesClass = { 1: 'truncate', 2: 'line-clamp-2', 3: 'line-clamp-3' } as const;

export function Txt({ variant = 'body', tone = 'primary', weight, align, tabular, lines, as, className, style, children, id, role }: TxtProps) {
  const Tag = (as ?? 'span') as ElementType;
  return (
    <Tag
      id={id}
      role={role}
      className={cx(
        'block',
        variantClass[variant],
        toneClass[tone],
        weight && weightClass[weight],
        align && alignClass[align],
        tabular && 'tabular',
        lines && linesClass[lines],
        className,
      )}
      style={style}
    >
      {children}
    </Tag>
  );
}

/** Inline emphasis inside a Txt: "**Alex** missed 15-122". */
export function Strong({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx('font-semibold text-text', className)}>{children}</span>;
}

/** Uppercase tracked section label with an optional trailing action. */
export function SectionLabel({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx('flex items-center justify-between mt-6 mb-2', className)}>
      <Txt variant="label" tone="tertiary">
        {children}
      </Txt>
      {action}
    </div>
  );
}

export function ErrorText({ children, className }: { children?: ReactNode; className?: string }) {
  if (!children) return null;
  return (
    <Txt variant="footnote" tone="danger" className={cx('mt-2', className)} role="alert" as="p">
      {children}
    </Txt>
  );
}
