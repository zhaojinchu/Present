import { cx } from './cx';

/** PLACEHOLDER mark until the logo is chosen: a black tile with a white P (same as the app icon). */
export function Mark({ size = 56, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cx('inline-flex items-center justify-center bg-accent text-text-inverse font-bold select-none shrink-0', className)}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.28), fontSize: Math.round(size * 0.58), lineHeight: 1, letterSpacing: -size * 0.02 }}
      aria-hidden
    >
      P
    </span>
  );
}

export function Wordmark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <span className={cx('inline-flex items-center', className)} style={{ gap: Math.round(size * 0.35) }}>
      <Mark size={size} />
      <span className="font-bold text-text" style={{ fontSize: size, lineHeight: 1.15, letterSpacing: -size * 0.03 }}>
        Present
      </span>
    </span>
  );
}
