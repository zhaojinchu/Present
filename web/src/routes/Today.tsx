// The schedule tab: the date, who is in class right now, the streak, the class that matters, and
// the rest of the day (collapsed past ten rows).
import { useMemo, useState } from 'react';
import { IoCalendarOutline, IoFlame, IoFlameOutline } from 'react-icons/io5';
import { useNavigate } from 'react-router';
import { Header, Main, Screen } from '@/app/AppShell';
import { LiveRow } from '@/components/feed/LiveRow';
import { ClassRow } from '@/components/today/ClassRow';
import { NotifyCard } from '@/components/today/NotifyCard';
import { PromptCard } from '@/components/today/PromptCard';
import { useAppState, useMe, useToday } from '@/lib/appState';
import { useNow } from '@/lib/clock';
import { onePerPerson, peopleInClass, type Phase } from '@/lib/phase';
import { fmtDate } from '@/lib/time';
import type { Occurrence } from '@/lib/types';
import { Button, Card, EmptyState, Group, Stat, Txt } from '@/ui';

const ROWS = 10;
const FINISHED = new Set<Phase>(['posted', 'posted_late', 'missed', 'excused']);
type Row = { occurrence: Occurrence; phase: Phase };

/**
 * Ten rows at a time, centred on what still matters: finished classes collapse behind "earlier",
 * the tail of the day behind "more". At the end of the day the last ten stay visible.
 */
function splitRows(rows: Row[]): { earlier: Row[]; shown: Row[]; more: Row[] } {
  const finished = rows.filter((r) => FINISHED.has(r.phase));
  const rest = rows.filter((r) => !FINISHED.has(r.phase));
  if (rest.length === 0) {
    const cut = Math.max(0, finished.length - ROWS);
    return { earlier: finished.slice(0, cut), shown: finished.slice(cut), more: [] };
  }
  return { earlier: finished, shown: rest.slice(0, ROWS), more: rest.slice(ROWS) };
}

export default function Today() {
  const now = useNow(1000);
  const me = useMe();
  const q = useAppState();
  const navigate = useNavigate();
  const { mine, theirs, focus, loading } = useToday(now);
  const inClass = useMemo(() => peopleInClass(theirs.map((t) => t.occurrence), now), [theirs, now]);
  const missByOccurrence = useMemo(() => new Map((q.data?.my_unexplained_misses ?? []).map((m) => [m.occurrence_id, m.id])), [q.data]);
  const friendsPostedFor = (course: string) => onePerPerson(theirs.filter((t) => t.occurrence.course_code === course && t.occurrence.status === 'posted').map((t) => t.occurrence));
  const alive = (me?.streak ?? 0) > 0;
  const [showEarlier, setShowEarlier] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const rows = useMemo(() => splitRows(mine), [mine]);

  const rowFor = ({ occurrence: o, phase }: Row) => (
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
  );

  return (
    <Screen tabs>
      <Header title="Today" large />
      <Main>
        <Txt variant="subhead" tone="secondary" className="-mt-1 mb-4">
          {fmtDate(now)}
        </Txt>

        {inClass.length > 0 ? (
          <div className="-mx-4 mb-3">
            <LiveRow inClass={inClass} />
          </div>
        ) : null}

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

        <NotifyCard className="mt-3" />

        {!loading && mine.length === 0 ? (
          <EmptyState
            icon={IoCalendarOutline}
            title="No classes today"
            message={me && me.class_count === 0 ? 'Import your schedule to get started.' : 'Enjoy it.'}
            action={me && me.class_count === 0 ? <Button title="Import schedule" size="lg" onClick={() => navigate('/schedule/import')} /> : undefined}
          />
        ) : null}

        {mine.length > 1 ? (
          <>
            <div className="flex items-end justify-between mt-6 mb-2">
              <Txt variant="label" tone="tertiary">
                Classes
              </Txt>
              <Txt variant="footnote" tone="tertiary" tabular>
                {mine.length} today
              </Txt>
            </div>
            {rows.earlier.length > 0 ? (
              <Button title={showEarlier ? 'Hide earlier' : `Show ${rows.earlier.length} earlier`} variant="tertiary" size="sm" className="mb-2 self-start" onClick={() => setShowEarlier((v) => !v)} />
            ) : null}
            <Group>
              {showEarlier ? rows.earlier.map(rowFor) : null}
              {rows.shown.map(rowFor)}
              {showMore ? rows.more.map(rowFor) : null}
            </Group>
            {rows.more.length > 0 ? (
              <Button title={showMore ? 'Show less' : `Show ${rows.more.length} more`} variant="tertiary" size="sm" className="mt-2 self-start" onClick={() => setShowMore((v) => !v)} />
            ) : null}
          </>
        ) : null}
        <div className="h-6" />
      </Main>
    </Screen>
  );
}
