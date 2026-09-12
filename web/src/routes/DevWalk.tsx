// /dev/walk — the one-tap photo walk. Tap the building you are standing in: a private window opens
// for you alone with a plausible course and room for that building, the camera opens, and after
// posting you land back here for the next one. Nothing resets, nobody else gets a class, and the
// posts feed the mock data later (npm run photos:pull + seed).
import { useMemo, useState } from 'react';
import { IoCameraOutline, IoOptionsOutline } from 'react-icons/io5';
import { useNavigate } from 'react-router';
import { Header, Main, Screen } from '@/app/AppShell';
import { dev } from '@/lib/api/social';
import { useAppState, useMe } from '@/lib/appState';
import { haptic } from '@/lib/haptics';
import { errorMessage } from '@/lib/supabase';
import { dayKey } from '@/lib/time';
import { Button, Txt, useToast } from '@/ui';
import { BackButton } from './_Stub';

/** Buildings on the walk, each with a few course/room labels that rotate tap by tap. */
const BUILDINGS: { key: string; name: string; rooms: [string, string][] }[] = [
  { key: 'GHC', name: 'Gates', rooms: [['15-112', 'GHC 4401'], ['15-213', 'GHC 4307'], ['15-251', 'GHC 4215']] },
  { key: 'DH', name: 'Doherty', rooms: [['21-259', 'DH 2210'], ['33-141', 'DH 2315'], ['21-241', 'DH 2302']] },
  { key: 'WEH', name: 'Wean', rooms: [['15-150', 'WEH 7500'], ['21-127', 'WEH 5403'], ['15-151', 'WEH 5310']] },
  { key: 'BH', name: 'Baker', rooms: [['80-100', 'BH 255B'], ['76-101', 'BH A51'], ['85-211', 'BH A36']] },
  { key: 'HH', name: 'Hamerschlag', rooms: [['18-220', 'HH 1107'], ['18-100', 'HH 1112'], ['18-240', 'HH B103']] },
  { key: 'PH', name: 'Porter', rooms: [['79-104', 'PH 100'], ['79-200', 'PH 125C'], ['84-104', 'PH 226C']] },
  { key: 'POS', name: 'Posner', rooms: [['36-200', 'POS 152'], ['36-202', 'POS 151'], ['70-122', 'POS 153']] },
  { key: 'TEP', name: 'Tepper', rooms: [['70-100', 'TEP 1403'], ['73-102', 'TEP 1307'], ['70-311', 'TEP 2700']] },
  { key: 'MM', name: 'Morrison', rooms: [['51-101', 'MM A14'], ['62-141', 'MM 103'], ['60-101', 'MM 121']] },
  { key: 'SH', name: 'Scaife', rooms: [['24-101', 'SH 125'], ['24-261', 'SH 219'], ['24-262', 'SH 220']] },
  { key: 'CUC', name: 'Cohon', rooms: [['99-101', 'CUC McConomy'], ['99-102', 'CUC Rangos'], ['99-103', 'CUC Danforth']] },
  { key: 'HBH', name: 'Hamburg', rooms: [['90-101', 'HBH 1002'], ['95-101', 'HBH 1202'], ['94-101', 'HBH A301']] },
];

const TURN_KEY = 'present:walk-turn';
function nextRoom(b: (typeof BUILDINGS)[number]): [string, string] {
  let turns: Record<string, number> = {};
  try {
    turns = JSON.parse(localStorage.getItem(TURN_KEY) ?? '{}');
  } catch {
    // ignore
  }
  const i = turns[b.key] ?? 0;
  turns[b.key] = i + 1;
  try {
    localStorage.setItem(TURN_KEY, JSON.stringify(turns));
  } catch {
    // ignore
  }
  return b.rooms[i % b.rooms.length];
}

export default function DevWalk() {
  const navigate = useNavigate();
  const toast = useToast();
  const me = useMe();
  const q = useAppState();
  const [busy, setBusy] = useState<string | null>(null);

  const today = dayKey(Date.now());
  const takenToday = useMemo(() => (q.data?.feed ?? []).filter((e) => e.type === 'post' && e.actor_id === me?.id && dayKey(e.created_at) === today).length, [q.data, me?.id, today]);

  const snap = async (b: (typeof BUILDINGS)[number]) => {
    if (busy) return;
    setBusy(b.key);
    haptic('light');
    try {
      const [course, room] = nextRoom(b);
      const id = await dev.photoWalk(course, room, 10);
      if (!id) throw new Error('No window came back (mock mode?)');
      navigate(`/post/${id}`, { state: { returnTo: '/dev/walk' } });
    } catch (e) {
      haptic('error');
      toast(errorMessage(e));
      setBusy(null);
    }
  };

  return (
    <Screen>
      <Header title="Photo walk" left={<BackButton />} right={<Button title="Custom" variant="tertiary" size="sm" icon={IoOptionsOutline} onClick={() => navigate('/dev')} />} />
      <Main>
        <Txt variant="subhead" tone="secondary" className="mt-2">
          Tap the building you are in. The camera opens, you present, and you come back here for the next one.
        </Txt>
        <Txt variant="footnote" tone="tertiary" className="mt-1 mb-4" tabular>
          {takenToday === 0 ? 'Nothing taken yet today.' : `${takenToday} taken today.`}
        </Txt>
        <div className="grid grid-cols-2 gap-2 mb-8">
          {BUILDINGS.map((b) => (
            <Button key={b.key} title={`${b.key} · ${b.name}`} variant={busy === b.key ? 'primary' : 'secondary'} size="lg" icon={IoCameraOutline} loading={busy === b.key} disabled={!!busy && busy !== b.key} onClick={() => snap(b)} />
          ))}
        </div>
      </Main>
    </Screen>
  );
}
