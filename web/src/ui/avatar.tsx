import { cx } from './cx';

const HUES = ['bg-avatar-1', 'bg-avatar-2', 'bg-avatar-3', 'bg-avatar-4', 'bg-avatar-5', 'bg-avatar-6'];

function hueFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return HUES[h % HUES.length];
}

export function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  );
}

/** Initials on a deterministic pastel fill, or the uploaded photo. */
export function Avatar({ name, src, size = 40, className, ring }: { name: string; src?: string | null; size?: number; className?: string; ring?: boolean }) {
  return (
    <span
      className={cx('inline-flex items-center justify-center rounded-full overflow-hidden shrink-0 select-none', !src && hueFor(name), ring && 'ring-2 ring-bg', className)}
      style={{ width: size, height: size }}
      aria-label={name}
      role="img"
    >
      {src ? (
        <img src={src} alt="" className="w-full h-full object-cover" draggable={false} />
      ) : (
        <span className="font-semibold text-text" style={{ fontSize: Math.round(size * 0.4), letterSpacing: size >= 56 ? -0.5 : 0 }}>
          {initialsOf(name)}
        </span>
      )}
    </span>
  );
}

/** Overlapping avatars, e.g. "who is there". */
export function AvatarStack({ people, size = 24, max = 4, className }: { people: { name: string; src?: string | null }[]; size?: number; max?: number; className?: string }) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  const overlap = -Math.round(size * 0.3);
  return (
    <span className={cx('inline-flex items-center', className)}>
      {shown.map((p, i) => (
        <Avatar key={`${p.name}-${i}`} name={p.name} src={p.src} size={size} ring className={i > 0 ? '' : undefined} {...(i > 0 ? { style: { marginLeft: overlap } } : {})} />
      ))}
      {rest > 0 ? (
        <span
          className="inline-flex items-center justify-center rounded-full bg-surface-overlay text-text-secondary font-semibold ring-2 ring-bg"
          style={{ width: size, height: size, marginLeft: overlap, fontSize: Math.round(size * 0.38) }}
        >
          +{rest}
        </span>
      ) : null}
    </span>
  );
}
