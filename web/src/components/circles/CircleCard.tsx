// The circle hero: the circle streak (everyone or nobody), best, this week, who is in it. `compact`
// is the single row at the top of the Present tab when a circle is selected: name, this week, the
// one class that matters right now, streak, chevron. Everything else waits behind the tap.
import { IoChevronForward, IoFlame, IoFlameOutline } from 'react-icons/io5';
import { useNavigate } from 'react-router';
import { groupLabel, presentCount, rankRollCall, rollCall, sessionPhase, type Group } from '@/lib/groups';
import { fmtTime } from '@/lib/time';
import type { Occurrence } from '@/lib/types';
import { AvatarStack, Card, cx, Icon, Stat, StreakChip, Txt } from '@/ui';

export function CircleCard({ group: g, compact, today = [], nowMs = 0, className }: { group: Group; compact?: boolean; /** Today's occurrences, for the live class line in compact mode. */ today?: Occurrence[]; nowMs?: number; className?: string }) {
  const navigate = useNavigate();
  const alive = g.streak > 0;
  const people = g.members.map((m) => ({ name: m.display_name, src: m.avatar_url }));
  const weekLine = g.week.total + g.week.upcoming > 0 ? `${g.week.made} of ${g.week.total + g.week.upcoming} this week` : 'No classes yet this week';

  if (compact) {
    const live = rankRollCall(rollCall(today, g), nowMs)[0];
    let liveLine = '';
    if (live) {
      const phase = sessionPhase(live, nowMs);
      const n = live.occurrences.length;
      liveLine =
        phase === 'open' || phase === 'late' ? `${live.course_code} now · ${presentCount(live)} of ${n} present`
        : phase === 'upcoming' ? `${live.course_code} at ${fmtTime(live.starts_at)} · ${n} of you`
        : `${live.course_code} · ${presentCount(live)} of ${n} made it`;
    }
    return (
      <button type="button" onClick={() => navigate(`/circles/${g.id}`)} className={cx('pressable w-full flex items-center gap-3 px-4 h-[56px] bg-surface text-left', className)} aria-label={`${g.name}, open circle`}>
        <span className="text-[22px] leading-none w-7 text-center">{g.emoji ?? '👥'}</span>
        <span className="flex-1 min-w-0">
          <Txt variant="headline" lines={1}>
            {g.name}
          </Txt>
          <Txt variant="footnote" tone="secondary" lines={1} tabular>
            {liveLine || weekLine}
          </Txt>
        </span>
        <StreakChip value={g.streak} size="sm" />
        <Icon icon={IoChevronForward} size={16} className="text-text-tertiary" />
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
