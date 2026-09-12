// /circles/:circleId/invite — friends who are not in the circle yet, one tap each, and the code for
// anyone else. The only place the code shows.
import { useState } from 'react';
import { IoAdd, IoShareOutline } from 'react-icons/io5';
import { useParams } from 'react-router';
import { Header, Main, Screen } from '@/app/AppShell';
import { addToGroup } from '@/lib/api/groups';
import { useAppState, useFriends, useInvalidateState } from '@/lib/appState';
import { env } from '@/lib/config';
import { GROUP_MAX_MEMBERS } from '@/lib/groups';
import { haptic } from '@/lib/haptics';
import { errorMessage } from '@/lib/supabase';
import { Avatar, Button, Group as GroupList, ListRow, Txt, useToast } from '@/ui';
import { BackButton } from './_Stub';

export default function CircleInvite() {
  const { circleId } = useParams<{ circleId: string }>();
  const q = useAppState();
  const { friends } = useFriends();
  const invalidate = useInvalidateState();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const g = q.data?.groups.find((x) => x.id === circleId) ?? null;
  if (!g) {
    return (
      <Screen>
        <Header title="Invite" left={<BackButton />} />
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
  const full = g.members.length >= GROUP_MAX_MEMBERS;
  const inviteUrl = `${env.appUrl || window.location.origin}/circles/join?code=${g.invite_code}`;

  const add = async (userId: string, name: string) => {
    setBusy(userId);
    haptic('light');
    try {
      await addToGroup(g.id, userId);
      await invalidate();
      haptic('success');
      toast(`${name.split(' ')[0]} is in`);
    } catch (e) {
      haptic('error');
      toast(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

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

  return (
    <Screen>
      <Header title={`Invite to ${g.name}`} left={<BackButton />} />
      <Main>
        {full ? (
          <Txt variant="subhead" tone="secondary" className="mt-2">
            This circle is full ({GROUP_MAX_MEMBERS} people).
          </Txt>
        ) : addable.length > 0 ? (
          <GroupList className="mt-2">
            {addable.map((f) => (
              <ListRow key={f.id} leading={<Avatar name={f.display_name} src={f.avatar_url} size={32} />} title={f.display_name} subtitle={`@${f.username}`} trailing={<Button title="Invite" size="sm" icon={IoAdd} loading={busy === f.id} onClick={() => add(f.id, f.display_name)} />} chevron={false} />
            ))}
          </GroupList>
        ) : (
          <Txt variant="subhead" tone="secondary" className="mt-2">
            All your friends are in.
          </Txt>
        )}

        {!full ? (
          <>
            <Txt variant="label" tone="tertiary" className="mt-6 mb-2">
              Anyone else
            </Txt>
            <div className="bg-surface rounded-lg p-4 flex items-center gap-3">
              <Txt variant="title" tabular className="flex-1" style={{ letterSpacing: 4 }}>
                {g.invite_code}
              </Txt>
              <Button title="Share" variant="secondary" size="sm" icon={IoShareOutline} onClick={share} />
            </div>
          </>
        ) : null}
      </Main>
    </Screen>
  );
}
