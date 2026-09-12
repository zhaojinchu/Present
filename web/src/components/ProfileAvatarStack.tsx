// Overlapping avatars where each one opens that person's profile. Same look as AvatarStack.
import { ProfileLink } from '@/components/ProfileLink';
import { Avatar, cx } from '@/ui';

export interface StackPerson {
  name: string;
  src?: string | null;
  username?: string | null;
}

export function ProfileAvatarStack({ people, size = 24, max = 4, className }: { people: StackPerson[]; size?: number; max?: number; className?: string }) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  const overlap = -Math.round(size * 0.3);
  return (
    <span className={cx('inline-flex items-center', className)}>
      {shown.map((p, i) => (
        <ProfileLink key={`${p.username ?? p.name}-${i}`} username={p.username} label={p.name} className="inline-flex rounded-full" {...(i > 0 ? {} : {})}>
          <span style={i > 0 ? { marginLeft: overlap } : undefined} className="inline-flex">
            <Avatar name={p.name} src={p.src} size={size} ring />
          </span>
        </ProfileLink>
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
