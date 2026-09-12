// The circle hero: the circle streak (everyone or nobody), best, this week, who is in it. `compact`
// is the one-line strip at the top of the Present tab when a circle is selected.
import { IoFlame, IoFlameOutline } from 'react-icons/io5';
import { useNavigate } from 'react-router';
import { groupLabel, type Group } from '@/lib/groups';
import { AvatarStack, Card, cx, Icon, Stat, StreakChip, Txt } from '@/ui';

export function CircleCard({ group: g, compact, className }: { group: Group; compact?: boolean; className?: string }) {
  const navigate = useNavigate();
  const alive = g.streak > 0;
  const people = g.members.map((m) => ({ name: m.display_name, src: m.avatar_url }));
  const weekLine = g.week.total + g.week.upcoming > 0 ? `${g.week.made} of ${g.week.total + g.week.upcoming} this week` : 'No classes yet this week';

  if (compact) {
    return (
      <button type="button" onClick={() => navigate(`/circles/${g.id}`)} className={cx('pressable w-full flex items-center gap-3 px-4 h-[56px] bg-surface text-left', className)}>
        <span className="text-[22px] leading-none w-7 text-center">{g.emoji ?? '👥'}</span>
        <span className="flex-1 min-w-0">
          <Txt variant="headline" lines={1}>
            {g.name}
          </Txt>
          <Txt variant="footnote" tone="secondary" lines={1}>
            {weekLine}
            {g.forfeit_text ? ` · stakes: ${g.forfeit_text}` : ''}
          </Txt>
        </span>
        <StreakChip value={g.streak} />
      </button>
    );
  }

  return (
    <Card className={className}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Txt variant="label" tone="tertiary">
            {groupLabel(g)}
          </Txt>
          <div className="flex items-center gap-1.5 mt-1">
            <Icon icon={alive ? IoFlame : IoFlameOutline} size={30} className={alive ? 'text-ember' : 'text-danger'} />
            <Txt variant="display" tone={alive ? 'primary' : 'danger'} tabular as="span">
              {g.streak}
            </Txt>
          </div>
          <Txt variant="label" tone="tertiary" className="mt-0.5">
            {alive ? 'Circle streak · everyone, every class' : 'Streak lost · everyone starts over'}
          </Txt>
        </div>
        <Stat size="md" value={g.best_streak} label="Best" align="end" />
      </div>
      <div className="hairline my-3" />
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <AvatarStack people={people} size={24} max={5} />
          <Txt variant="footnote" tone="secondary" lines={1}>
            {g.members.length} {g.members.length === 1 ? 'member' : 'members'} · {weekLine}
          </Txt>
        </div>
      </div>
      {g.forfeit_text ? (
        <Txt variant="footnote" tone="tertiary" className="mt-2" lines={1}>
          Stakes: a miss {g.forfeit_text}.
        </Txt>
      ) : null}
    </Card>
  );
}
