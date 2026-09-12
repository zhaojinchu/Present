// A ring that drains as the on-time window runs out, with the remaining time inside.
import { fmtCountdown } from '@/lib/time';
import { cx, Txt } from '@/ui';

export function CountdownRing({ remainingMs, totalMs, size = 112, tone = 'accent', className }: { remainingMs: number; totalMs: number; size?: number; tone?: 'accent' | 'warning'; className?: string }) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = totalMs > 0 ? Math.min(1, Math.max(0, remainingMs / totalMs)) : 0;
  const color = tone === 'warning' ? 'text-warning' : 'text-text';
  return (
    <div className={cx('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }} role="timer" aria-label={fmtCountdown(remainingMs)}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-surface-overlay" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          className={cx(color, 'transition-[stroke-dashoffset] duration-1000 ease-linear')}
        />
      </svg>
      <Txt variant="title" tabular className="absolute">
        {fmtCountdown(remainingMs)}
      </Txt>
    </div>
  );
}
