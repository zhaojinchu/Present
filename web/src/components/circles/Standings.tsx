// This week's standings inside a circle: classes made of total, on-time count, misses. A trophy on
// the top row; the bottom row is highlighted when it has misses (that is who owes).
import { IoTrophy } from 'react-icons/io5';
import { ProfileLink } from '@/components/ProfileLink';
import { type Group, sortedStandings } from '@/lib/groups';
import { Avatar, cx, Icon, Txt } from '@/ui';

export function Standings({ group: g, meId, className }: { group: Group; meId: string | null; className?: string }) {
  const rows = sortedStandings(g);
  if (rows.length === 0) return null;
  const last = rows[rows.length - 1];
  return (
    <div className={cx('bg-surface rounded-lg overflow-hidden', className)}>
      {rows.map((r, i) => {
        const isMe = r.id === meId;
        const bottom = rows.length > 1 && r.id === last.id && r.missed > 0;
        return (
          <div key={r.id} className={cx('flex items-center gap-3 px-4 min-h-[48px]', i > 0 && 'border-t border-border', bottom && 'bg-danger-soft')}>
            <span className="w-5 flex items-center justify-end">
              {i === 0 && r.made > 0 ? <Icon icon={IoTrophy} size={16} className="text-ember" /> : <Txt variant="footnote" tone="tertiary" tabular as="span">{i + 1}</Txt>}
            </span>
            <ProfileLink username={r.username || null} label={r.display_name} className="flex items-center gap-3 flex-1 min-w-0">
              <Avatar name={r.display_name} src={r.avatar_url} size={28} />
              <Txt variant="subhead" weight={isMe ? 600 : 400} className="flex-1 min-w-0" lines={1}>
                {isMe ? 'You' : r.display_name}
              </Txt>
            </ProfileLink>
            {r.missed > 0 ? (
              <Txt variant="footnote" tone="danger" tabular as="span">
                {r.missed} missed
              </Txt>
            ) : r.late > 0 ? (
              <Txt variant="footnote" tone="warning" tabular as="span">
                {r.late} late
              </Txt>
            ) : null}
            <Txt variant="subhead" tone={isMe ? 'primary' : 'secondary'} tabular as="span" className="w-12 text-right">
              {r.made}
              <span className="text-text-tertiary"> / {r.total}</span>
            </Txt>
          </div>
        );
      })}
    </div>
  );
}
