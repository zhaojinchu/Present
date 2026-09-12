// This week in numbers, from get_stats(): classes made, on-time rate, hours in class, and where
// I sit among my friends. The Strava move: the receipts become data you are proud of.
import { useQuery } from '@tanstack/react-query';
import { IoFlame } from 'react-icons/io5';
import { getStats, type UserStats } from '@/lib/api/presence';
import { useAppState } from '@/lib/appState';
import { ProfileLink } from '@/components/ProfileLink';
import { Avatar, Card, cx, Skeleton, Stat, Txt } from '@/ui';

export const STATS_KEY = ['stats'] as const;
type LiveMap = Map<string, { display_name: string; avatar_url: string | null; username: string }>;

function pct(n: number, d: number): number | null {
  return d > 0 ? Math.round((100 * n) / d) : null;
}

function hours(minutes: number): string {
  const h = minutes / 60;
  return h >= 10 ? String(Math.round(h)) : h.toFixed(1).replace(/\.0$/, '');
}

export function WeekStats({ className }: { className?: string }) {
  const state = useAppState();
  const q = useQuery({ queryKey: STATS_KEY, queryFn: getStats, enabled: !!state.data, staleTime: 15_000, refetchOnWindowFocus: true });

  if (q.isPending) return <Skeleton className={cx('h-40', className)} />;
  if (!q.data) return null;
  const me = q.data.me;
  // Names and photos come from the live state, never from the stats snapshot.
  const people: LiveMap = new Map();
  if (state.data) {
    people.set(state.data.me.id, state.data.me);
    for (const f of state.data.friends) people.set(f.id, f);
  }
  const made = me.week_on_time + me.week_late;
  const total = me.week_total + me.week_upcoming;
  const onTime = pct(me.week_on_time, me.week_on_time + me.week_late + me.week_missed);
  const progress = total > 0 ? Math.min(1, made / total) : 0;

  return (
    <Card className={className}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <Txt variant="label" tone="tertiary">
            This week
          </Txt>
          <div className="flex items-baseline gap-1.5 mt-1">
            <Txt variant="display" tabular as="span">
              {made}
            </Txt>
            <Txt variant="subhead" tone="secondary" tabular as="span">
              of {total} {total === 1 ? 'class' : 'classes'}
            </Txt>
          </div>
        </div>
        <Stat size="sm" value={me.best_streak} label="Best streak" icon={IoFlame} iconClassName="text-ember" align="end" />
      </div>

      <div className="mt-3 h-1.5 rounded-full bg-surface-raised overflow-hidden" role="progressbar" aria-valuenow={made} aria-valuemin={0} aria-valuemax={total}>
        <div className="h-full rounded-full bg-text transition-[width] duration-[var(--duration-slow)]" style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="flex justify-between mt-1.5">
        <Txt variant="footnote" tone="secondary" tabular>
          {me.week_on_time} on time{me.week_late > 0 ? ` · ${me.week_late} late` : ''}
          {me.week_missed > 0 ? ` · ${me.week_missed} missed` : ''}
        </Txt>
        <Txt variant="footnote" tone="tertiary" tabular>
          {me.week_upcoming > 0 ? `${me.week_upcoming} to go` : 'Week done'}
        </Txt>
      </div>

      <div className="flex gap-6 mt-4">
        <Stat size="sm" value={onTime === null ? '–' : `${onTime}%`} label="On time" />
        <Stat size="sm" value={hours(me.minutes_in_class)} label="Hours in class" />
        <Stat size="sm" value={me.term_posted} label="Presents this term" />
      </div>

      {q.data.friends.length > 0 ? <FriendsWeek me={me} friends={q.data.friends} people={people} /> : null}
    </Card>
  );
}

/** Everyone ranked by classes made this week, with me highlighted. */
function FriendsWeek({ me, friends, people }: { me: UserStats; friends: UserStats[]; people: LiveMap }) {
  const rows = [...friends, me]
    .map((u) => ({ ...u, made: u.week_on_time + u.week_late, of: u.week_total + u.week_upcoming }))
    .sort((a, b) => b.made - a.made || b.week_on_time - a.week_on_time || (a.display_name ?? '').localeCompare(b.display_name ?? ''));
  return (
    <div className="mt-4">
      <Txt variant="label" tone="tertiary" className="mb-1">
        Among friends
      </Txt>
      {rows.map((u, i) => {
        const isMe = u.id === me.id;
        const live = people.get(u.id);
        const name = live?.display_name ?? u.display_name ?? '?';
        return (
          <ProfileLink key={u.id} username={live?.username ?? u.username} label={name} className="flex items-center gap-3 h-9 w-full">
            <Txt variant="footnote" tone="tertiary" tabular className="w-4 text-right">
              {i + 1}
            </Txt>
            <Avatar name={name} src={live?.avatar_url ?? u.avatar_url ?? null} size={24} />
            <Txt variant="subhead" weight={isMe ? 600 : 400} className="flex-1 min-w-0" lines={1}>
              {isMe ? 'You' : name}
            </Txt>
            <Txt variant="subhead" tone={isMe ? 'primary' : 'secondary'} tabular>
              {u.made}
              <span className="text-text-tertiary"> / {u.of}</span>
            </Txt>
          </ProfileLink>
        );
      })}
    </div>
  );
}
