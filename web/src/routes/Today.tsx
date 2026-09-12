// The schedule tab: the streak, the class that matters right now, the rest of the day.
import { useMemo } from 'react';
import { IoFlame, IoFlameOutline } from 'react-icons/io5';
import { useNavigate } from 'react-router';
import { Header, Main, Screen } from '@/app/AppShell';
import { LiveRow } from '@/components/feed/LiveRow';
import { ClassRow } from '@/components/today/ClassRow';
import { PromptCard } from '@/components/today/PromptCard';
import { useAppState, useMe, useToday } from '@/lib/appState';
import { useNow } from '@/lib/clock';
import { inClassNow } from '@/lib/phase';
import { fmtDate } from '@/lib/time';
import { Button, Card, EmptyState, Group, Stat, Txt } from '@/ui';
import { IoCalendarOutline } from 'react-icons/io5';

export default function Today() {
  const now = useNow(1000);
  const me = useMe();
  const q = useAppState();
  const navigate = useNavigate();
  const { mine, theirs, focus, loading } = useToday(now);
  const inClass = useMemo(() => theirs.filter((t) => inClassNow(t.occurrence, now)).map((t) => t.occurrence), [theirs, now]);
  const missByOccurrence = useMemo(() => new Map((q.data?.my_unexplained_misses ?? []).map((m) => [m.occurrence_id, m.id])), [q.data]);
  const friendsPostedFor = (course: string) => theirs.filter((t) => t.occurrence.course_code === course && t.occurrence.status === 'posted').map((t) => t.occurrence);
  const alive = (me?.streak ?? 0) > 0;

  return (
    <Screen tabs>
      <Header title="Today" large />
      <Main>
        <Txt variant="subhead" tone="secondary" className="-mt-1 mb-4">
          {fmtDate(now)}
        </Txt>

        {me ? (
          <Card className="flex items-start justify-between">
            <Stat size="lg" value={me.streak} label={alive ? 'Day streak' : 'Streak lost'} icon={alive ? IoFlame : IoFlameOutline} iconClassName={alive ? 'text-ember' : 'text-danger'} tone={alive ? 'primary' : 'danger'} />
            <Stat size="md" value={me.best_streak} label="Best" align="end" />
          </Card>
        ) : null}

        {focus ? (
          <div className="mt-3">
            <PromptCard occurrence={focus.occurrence} phase={focus.phase} nowMs={now} friendsPosted={friendsPostedFor(focus.occurrence.course_code)} unexplainedMissId={missByOccurrence.get(focus.occurrence.id) ?? null} />
          </div>
        ) : null}

        {!loading && mine.length === 0 ? (
          <EmptyState
            icon={IoCalendarOutline}
            title="No classes today"
            message={me && me.class_count === 0 ? 'Import your schedule to get started.' : 'Enjoy it.'}
            action={me && me.class_count === 0 ? <Button title="Import schedule" size="lg" onClick={() => navigate('/schedule/import')} /> : undefined}
          />
        ) : null}

        {inClass.length > 0 ? (
          <div className="mt-6 -mx-4">
            <LiveRow inClass={inClass} />
          </div>
        ) : null}

        {mine.length > 1 ? (
          <>
            <Txt variant="label" tone="tertiary" className="mt-6 mb-2">
              Classes
            </Txt>
            <Group>
              {mine.map(({ occurrence: o, phase }) => (
                <ClassRow
                  key={o.id}
                  occurrence={o}
                  phase={phase}
                  onClick={
                    phase === 'open' || phase === 'late'
                      ? () => navigate(`/post/${o.id}`)
                      : phase === 'missed' && missByOccurrence.has(o.id)
                        ? () => navigate(`/explain/${missByOccurrence.get(o.id)}`)
                        : undefined
                  }
                />
              ))}
            </Group>
          </>
        ) : null}
        <div className="h-6" />
      </Main>
    </Screen>
  );
}
