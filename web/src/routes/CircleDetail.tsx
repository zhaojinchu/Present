// /circles/:circleId — the circle: streak, today's roll call, this week's standings, stakes, members.
import { useState } from 'react';
import { IoAdd, IoCopyOutline, IoExitOutline, IoShareOutline } from 'react-icons/io5';
import { useNavigate, useParams } from 'react-router';
import { Header, Main, Screen } from '@/app/AppShell';
import { CircleCard } from '@/components/circles/CircleCard';
import { RollCall } from '@/components/circles/RollCall';
import { Stakes } from '@/components/circles/Stakes';
import { Standings } from '@/components/circles/Standings';
import { addToGroup, leaveGroup } from '@/lib/api/groups';
import { useAppState, useFriends, useInvalidateState, useMe } from '@/lib/appState';
import { useNow } from '@/lib/clock';
import { env } from '@/lib/config';
import { GROUP_MAX_MEMBERS, groupLabel, rollCall } from '@/lib/groups';
import { errorMessage } from '@/lib/supabase';
import { Avatar, Button, Group as GroupList, IconButton, ListRow, StreakChip, Txt, useToast } from '@/ui';
import { BackButton } from './_Stub';

export default function CircleDetail() {
  const { circleId } = useParams<{ circleId: string }>();
  const navigate = useNavigate();
  const now = useNow(1000);
  const q = useAppState();
  const me = useMe();
  const { friends } = useFriends();
  const invalidate = useInvalidateState();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const g = q.data?.groups.find((x) => x.id === circleId) ?? null;
  const today = q.data?.today_occurrences ?? [];

  if (!g) {
    return (
      <Screen>
        <Header title="Circle" left={<BackButton />} />
        <Main>
          <Txt variant="subhead" tone="secondary" className="mt-4">
            {q.isPending ? 'Loading…' : 'This circle is not on your list.'}
          </Txt>
        </Main>
      </Screen>
    );
  }

  const memberIds = new Set(g.members.map((m) => m.id));
  const addable = friends.filter((f) => !memberIds.has(f.id));
  const inviteUrl = `${env.appUrl || window.location.origin}/circles/join?code=${g.invite_code}`;
  const sessions = rollCall(today, g);

  const share = async () => {
    const text = `Join "${g.name}" on Present with code ${g.invite_code}: ${inviteUrl}`;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: `Join ${g.name} on Present`, text, url: inviteUrl });
        return;
      } catch {
        // cancelled or unsupported
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast('Invite copied');
    } catch {
      toast(g.invite_code);
    }
  };

  const add = async (userId: string, name: string) => {
    setBusy(userId);
    try {
      await addToGroup(g.id, userId);
      await invalidate();
      toast(`${name.split(' ')[0]} is in`);
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const leave = async () => {
    if (!confirmLeave) {
      setConfirmLeave(true);
      window.setTimeout(() => setConfirmLeave(false), 4000);
      return;
    }
    setBusy('leave');
    try {
      await leaveGroup(g.id);
      await invalidate();
      navigate('/circles', { replace: true });
    } catch (e) {
      toast(errorMessage(e));
      setBusy(null);
    }
  };

  return (
    <Screen>
      <Header title={groupLabel(g)} left={<BackButton />} right={<IconButton icon={IoShareOutline} label="Invite" tone="plain" onClick={share} />} />
      <Main>
        <CircleCard group={g} className="mt-1" />

        {sessions.length > 0 ? (
          <>
            <Txt variant="label" tone="tertiary" className="mt-6 mb-2">
              Roll call today
            </Txt>
            <RollCall group={g} today={today} nowMs={now} />
          </>
        ) : null}

        <Txt variant="label" tone="tertiary" className="mt-6 mb-2">
          This week
        </Txt>
        <Standings group={g} meId={me?.id ?? null} />

        <Txt variant="label" tone="tertiary" className="mt-6 mb-2">
          Stakes
        </Txt>
        <Stakes group={g} meId={me?.id ?? null} nowMs={now} />

        <Txt variant="label" tone="tertiary" className="mt-6 mb-2">
          Members
        </Txt>
        <GroupList>
          {g.members.map((m) => (
            <ListRow key={m.id} leading={<Avatar name={m.display_name} src={m.avatar_url} size={32} />} title={m.id === me?.id ? `${m.display_name} (you)` : m.display_name} subtitle={`@${m.username}`} trailing={<StreakChip value={m.streak} size="sm" />} onClick={m.id === me?.id ? undefined : () => navigate(`/u/${m.username}`)} chevron={false} />
          ))}
        </GroupList>

        {addable.length > 0 && g.members.length < GROUP_MAX_MEMBERS ? (
          <>
            <Txt variant="label" tone="tertiary" className="mt-6 mb-2">
              Invite friends
            </Txt>
            <GroupList>
              {addable.map((f) => (
                <ListRow key={f.id} leading={<Avatar name={f.display_name} src={f.avatar_url} size={32} />} title={f.display_name} subtitle={`@${f.username}`} trailing={<Button title="Invite" size="sm" icon={IoAdd} loading={busy === f.id} onClick={() => add(f.id, f.display_name)} />} chevron={false} />
              ))}
            </GroupList>
          </>
        ) : null}

        <Txt variant="label" tone="tertiary" className="mt-6 mb-2">
          Invite
        </Txt>
        <div className="bg-surface rounded-lg p-4 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <Txt variant="title" tabular style={{ letterSpacing: 4 }}>
              {g.invite_code}
            </Txt>
            <Txt variant="footnote" tone="secondary" lines={1}>
              Anyone with the code can join, friend or not.
            </Txt>
          </div>
          <Button title="Copy" variant="secondary" size="sm" icon={IoCopyOutline} onClick={share} />
        </div>

        <Button title={confirmLeave ? 'Tap again to leave' : 'Leave circle'} variant={confirmLeave ? 'destructive' : 'tertiary'} size="lg" icon={IoExitOutline} loading={busy === 'leave'} className="mt-8 mb-8" onClick={leave} />
      </Main>
    </Screen>
  );
}
