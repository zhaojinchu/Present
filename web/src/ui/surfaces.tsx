import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { IoChevronForward } from 'react-icons/io5';
import { cx } from './cx';
import { Icon } from './icon';
import { Txt } from './text';

/** 1px hairline. `inset` starts it at the text column of a list row. */
export function Divider({ inset = 0, className }: { inset?: number; className?: string }) {
  return <div className={cx('hairline', className)} style={{ marginLeft: inset }} role="separator" />;
}

/** Flat raised surface. No border, no coloured edge. Hero blocks and grouped lists only. */
export function Card({ children, padded = true, className }: { children: ReactNode; padded?: boolean; className?: string }) {
  return <div className={cx('bg-surface rounded-lg overflow-hidden', padded && 'p-4', className)}>{children}</div>;
}

/** Inset grouped list container: children are rows; hairlines go between them. */
export function Group({ children, className }: { children: ReactNode; className?: string }) {
  const items = Children.toArray(children).filter((c) => isValidElement(c) || typeof c === 'string');
  return (
    <div className={cx('bg-surface rounded-lg overflow-hidden', className)}>
      {items.map((child, i) => (
        <Fragment key={i}>
          {i > 0 ? <Divider inset={16} /> : null}
          {child}
        </Fragment>
      ))}
    </div>
  );
}

/** Standard list row: leading | title + subtitle | trailing (+ chevron when tappable). */
export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  onClick,
  chevron,
  destructive,
  className,
}: {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  chevron?: boolean;
  destructive?: boolean;
  className?: string;
}) {
  const showChevron = chevron ?? !!onClick;
  const body = (
    <>
      {leading ? <span className="flex items-center justify-center shrink-0">{leading}</span> : null}
      <span className="flex flex-col flex-1 min-w-0 gap-0.5 text-left">
        {typeof title === 'string' ? (
          <Txt variant="body" tone={destructive ? 'danger' : 'primary'} lines={1}>
            {title}
          </Txt>
        ) : (
          title
        )}
        {subtitle ? (
          typeof subtitle === 'string' ? (
            <Txt variant="footnote" tone="secondary" lines={1}>
              {subtitle}
            </Txt>
          ) : (
            subtitle
          )
        ) : null}
      </span>
      {trailing ? <span className="flex items-center justify-end shrink-0">{trailing}</span> : null}
      {showChevron ? <Icon icon={IoChevronForward} size={20} className="text-text-tertiary" /> : null}
    </>
  );
  const base = 'flex items-center w-full min-h-[52px] px-4 py-3 gap-3';
  if (!onClick) return <div className={cx(base, className)}>{body}</div>;
  return (
    <button type="button" onClick={onClick} className={cx(base, 'active:bg-surface-raised transition-colors duration-[var(--duration-fast)]', className)}>
      {body}
    </button>
  );
}

/** Quote box for explanations and comments-as-quotes. */
export function Quote({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('bg-surface-raised rounded-md p-3 selectable', className)}>{children}</div>;
}
