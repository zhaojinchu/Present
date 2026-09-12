// /dev — demo controls. Reached by five taps on your avatar. Hidden unless VITE_DEV_PANEL is on.
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Header, Main, Screen } from '@/app/AppShell';
import { dev } from '@/lib/api/social';
import { useAppState, useFriends, useInvalidateState, useToday } from '@/lib/appState';
import { getDevOffsetMinutes, setDevOffsetMinutes, useNow } from '@/lib/clock';
import { env } from '@/lib/config';
import { getPosition } from '@/lib/location';
import { errorMessage } from '@/lib/supabase';
import { Button, Chip, Group, Input, ListRow, Txt } from '@/ui';
import { BackButton } from './_Stub';

export default function Dev() {
  const now = useNow(1000);
  const q = useAppState();
  const invalidate = useInvalidateState();
  const { friends } = useFriends();
  const { focus } = useToday(now);
  const navigate = useNavigate();
  const [course, setCourse] = useState('15-122');
  const [walkCourse, setWalkCourse] = useState('15-122');
  const [walkRoom, setWalkRoom] = useState('');
  const [walkMinutes, setWalkMinutes] = useState(10);
  const [onTime, setOnTime] = useState(2);
  const [lateMin, setLateMin] = useState(2);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    const t0 = Date.now();
    try {
      const r = await fn();
      await invalidate();
      setLog((l) => [`${new Date().toLocaleTimeString()} ${label}: ${r === undefined ? 'ok' : JSON.stringify(r)} (${Date.now() - t0} ms)`, ...l].slice(0, 30));
    } catch (e) {
      setLog((l) => [`${new Date().toLocaleTimeString()} ${label}: ERROR ${errorMessage(e)}`, ...l].slice(0, 30));
    } finally {
      setBusy(null);
    }
  };

  const offset = getDevOffsetMinutes();
  return (
    <Screen>
      <Header title="Demo controls" left={<BackButton />} />
      <Main>
        <Txt variant="label" tone="tertiary" className="mt-2 mb-2">
          Photo walk
        </Txt>
        <Txt variant="footnote" tone="secondary" className="mb-2">
          Opens a window for you alone, right now, for a real room. Nothing resets, nobody else gets a class, and the photos stay for the demo.
        </Txt>
        <Button title="One tap per building" size="lg" className="mb-3" onClick={() => navigate('/dev/walk')} />
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Input value={walkCourse} onChange={(e) => setWalkCourse(e.target.value.slice(0, 32))} placeholder="Course code" autoCapitalize="characters" autoCorrect="off" spellCheck={false} className="flex-1" />
            <Input value={String(walkMinutes)} onChange={(e) => setWalkMinutes(Math.max(3, Math.min(120, Number(e.target.value.replace(/\D/g, '')) || 0)))} inputMode="numeric" placeholder="min" className="!w-[76px]" aria-label="Minutes" />
          </div>
          <Input value={walkRoom} onChange={(e) => setWalkRoom(e.target.value.slice(0, 120))} placeholder="Room, e.g. GHC 4401" autoCorrect="off" spellCheck={false} />
          <Button
            title="Open a window for me now"
            size="lg"
            loading={busy === 'photo walk'}
            disabled={!walkCourse.trim()}
            onClick={() =>
              run('photo walk', async () => {
                const id = await dev.photoWalk(walkCourse.trim(), walkRoom.trim(), walkMinutes || 10);
                navigate(`/post/${id}`);
                return id;
              })
            }
          />
        </div>

        <Txt variant="label" tone="tertiary" className="mt-6 mb-2">
          The moment
        </Txt>
        <div className="flex gap-2 mb-2">
          <Input value={course} onChange={(e) => setCourse(e.target.value)} placeholder="Course code" className="flex-1" />
          <Input type="number" inputMode="numeric" value={onTime} onChange={(e) => setOnTime(Number(e.target.value))} className="w-20" aria-label="On-time minutes" />
          <Input type="number" inputMode="numeric" value={lateMin} onChange={(e) => setLateMin(Number(e.target.value))} className="w-20" aria-label="Late minutes" />
        </div>
        <div className="flex flex-col gap-2">
          <Button title={`Start ${course} now (${onTime} min on time, then ${lateMin} min late)`} size="lg" loading={busy === 'start'} onClick={() => run('start', () => dev.startClassNow(course, onTime, lateMin))} />
          <Button title="End on-time now (next post is late)" variant="secondary" size="lg" loading={busy === 'endOnTime'} onClick={() => run('endOnTime', dev.endOnTimeNow)} />
          <Button title="End window now (pending become misses)" variant="secondary" size="lg" loading={busy === 'endWindow'} onClick={() => run('endWindow', dev.endWindowNow)} />
          <Button title="Reset demo" variant="destructive" size="lg" loading={busy === 'reset'} onClick={() => run('reset', dev.reset)} />
        </div>

        <Txt variant="label" tone="tertiary" className="mt-6 mb-2">
          Replay (if a phone dies)
        </Txt>
        <Group>
          {friends.map((f) => (
            <ListRow key={f.id} title={`Post as ${f.display_name}`} subtitle={`@${f.username}`} onClick={() => run(`post as ${f.username}`, () => dev.replayPost(f.id))} chevron={false} />
          ))}
          <ListRow title="Post the latest unexplained miss's explanation" subtitle='"phone died"' onClick={() => run('explanation', () => dev.replayExplanation('phone died'))} chevron={false} />
        </Group>

        <Txt variant="label" tone="tertiary" className="mt-6 mb-2">
          Location and time
        </Txt>
        <div className="flex flex-col gap-2">
          <Button
            title="Pin the demo class to where I am"
            variant="secondary"
            size="lg"
            loading={busy === 'pin'}
            onClick={() =>
              run('pin', async () => {
                const fix = await getPosition(8000);
                if (!fix) throw new Error('No GPS fix');
                return dev.pinHere(fix.lat, fix.lng);
              })
            }
          />
          <Button title="Run miss detection now" variant="secondary" size="lg" loading={busy === 'detect'} onClick={() => run('detect', dev.detectMisses)} />
          <Button title="Generate my occurrences (yesterday to tomorrow)" variant="secondary" size="lg" loading={busy === 'ensure'} onClick={() => run('ensure', dev.ensureOccurrences)} />
        </div>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <Txt variant="footnote" tone="secondary">
            Clock offset (this phone only): {offset >= 0 ? '+' : ''}
            {offset} min
          </Txt>
          {[-60, -5, 5, 60].map((d) => (
            <Chip key={d} label={`${d > 0 ? '+' : ''}${d}`} onClick={() => setDevOffsetMinutes(offset + d)} />
          ))}
          <Chip label="reset" onClick={() => setDevOffsetMinutes(0)} />
        </div>

        <Txt variant="label" tone="tertiary" className="mt-6 mb-2">
          Status
        </Txt>
        <Group>
          <ListRow title="Backend" subtitle={env.mockState ? 'mock fixture' : env.supabaseUrl} chevron={false} />
          <ListRow title="State" subtitle={q.dataUpdatedAt ? `fetched ${Math.round((Date.now() - q.dataUpdatedAt) / 1000)} s ago${q.isFetching ? ', refreshing' : ''}` : q.status} chevron={false} />
          <ListRow title="Me" subtitle={q.data ? `@${q.data.me.username} · streak ${q.data.me.streak} · posted today: ${q.data.me.posted_today}` : ''} chevron={false} />
          <ListRow title="Focus" subtitle={focus ? `${focus.occurrence.course_code} · ${focus.phase}` : 'none'} chevron={false} />
        </Group>

        {log.length > 0 ? (
          <div className="mt-6 bg-surface rounded-md p-3 selectable">
            {log.map((l, i) => (
              <Txt key={i} variant="footnote" tone="secondary" className="font-mono">
                {l}
              </Txt>
            ))}
          </div>
        ) : null}
        <div className="h-8" />
      </Main>
    </Screen>
  );
}
