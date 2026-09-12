// /circles/:circleId — the circle: streak, today's roll call, this week's standings, stakes. Invite
// is the person-plus in the header; everything else (rename, stakes, remove members, delete or leave)
// lives behind the ellipsis so the page itself stays short.
import { useState } from 'react';
import { IoCreateOutline, IoEllipsisHorizontal, IoPersonAddOutline } from 'react-icons/io5';
import { useNavigate, useParams } from 'react-router';
import { Header, Main, Screen } from '@/app/AppShell';
import { CircleCard } from '@/components/circles/CircleCard';
import { RollCall } from '@/components/circles/RollCall';
import { Stakes } from '@/components/circles/Stakes';
import { Standings } from '@/components/circles/Standings';
import { deleteGroup, leaveGroup, removeFromGroup } from '@/lib/api/groups';
import { useAppState, useInvalidateState, useMe } from '@/lib/appState';
import { useNow } from '@/lib/clock';
import { haptic } from '@/lib/haptics';
import { type Group, groupLabel, rollCall } from '@/lib/groups';
import { errorMessage } from '@/lib/supabase';
import { Avatar, Button, Group as GroupList, IconButton, ListRow, Sheet, Txt, useToast } from '@/ui';
import { BackButton } from './_Stub';

export default function CircleDetail() {
  const { circleId } = useParams<{ circleId: string }>();
  const navigate = useNavigate();
  const now = useNow(1000);
  const q = useAppState();
  const me = useMe();
  const [manage, setManage] = useState(false);

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

  const sessions = rollCall(today, g);
  const hasStakes = !!g.forfeit_text || g.forfeits.length > 0;

  return (
    <Screen>
      <Header
        title={groupLabel(g)}
        left={<BackButton />}
        right={
          <>
            <IconButton icon={IoPersonAddOutline} label="Invite friends" tone="plain" onClick={() => navigate(`/circles/${g.id}/invite`)} />
            <IconButton icon={IoEllipsisHorizontal} label="Manage circle" tone="plain" onClick={() => setManage(true)} />
          </>
        }
      />
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
          Members · this week
        </Txt>
        <Standings group={g} meId={me?.id ?? null} />

        {hasStakes ? (
          <>
            <Txt variant="label" tone="tertiary" className="mt-6 mb-2">
              Stakes
            </Txt>
            <Stakes group={g} meId={me?.id ?? null} nowMs={now} className="mb-8" />
          </>
        ) : (
          <div className="mb-8" />
        )}
      </Main>

      <ManageSheet group={g} meId={me?.id ?? null} open={manage} onOpenChange={setManage} />
    </Screen>
  );
}

/** Rename and stakes, invite, remove members (creator), delete (creator) or leave (member). */
function ManageSheet({ group: g, meId, open, onOpenChange }: { group: Group; meId: string | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const invalidate = useInvalidateState();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const creator = g.created_by === meId;

  const go = (to: string) => {
    onOpenChange(false);
    navigate(to);
  };

  // Destructive actions ask for a second tap within four seconds.
  const armed = (key: string) => confirm === key;
  const arm = (key: string) => {
    setConfirm(key);
    window.setTimeout(() => setConfirm((c) => (c === key ? null : c)), 4000);
  };

  const remove = async (userId: string, name: string) => {
    if (!armed(userId)) return arm(userId);
    setBusy(userId);
    haptic('light');
    try {
      await removeFromGroup(g.id, userId);
      await invalidate();
      haptic('success');
      toast(`${name.split(' ')[0]} removed`);
    } catch (e) {
      haptic('error');
      toast(errorMessage(e));
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  };

  const destroy = async () => {
    if (!armed('delete')) return arm('delete');
    setBusy('delete');
    haptic('light');
    try {
      await deleteGroup(g.id);
      await invalidate();
      onOpenChange(false);
      navigate('/circles', { replace: true });
    } catch (e) {
      haptic('error');
      toast(errorMessage(e));
      setBusy(null);
    }
  };

  const leave = async () => {
    if (!armed('leave')) return arm('leave');
    setBusy('leave');
    haptic('light');
    try {
      await leaveGroup(g.id);
      await invalidate();
      onOpenChange(false);
      navigate('/circles', { replace: true });
    } catch (e) {
      haptic('error');
      toast(errorMessage(e));
      setBusy(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={g.name}>
      <GroupList>
        {creator ? <ListRow leading={<IoCreateOutline size={20} className="text-text-secondary" />} title="Name, emoji and stakes" onClick={() => go(`/circles/${g.id}/edit`)} /> : null}
        <ListRow leading={<IoPersonAddOutline size={20} className="text-text-secondary" />} title="Invite friends" onClick={() => go(`/circles/${g.id}/invite`)} />
      </GroupList>

      <Txt variant="label" tone="tertiary" className="mt-5 mb-2">
        Members
      </Txt>
      <GroupList>
        {g.members.map((m) => {
          const self = m.id === meId;
          const trailing =
            self ? (
              <Txt variant="footnote" tone="tertiary" as="span">
                You
              </Txt>
            ) : creator ? (
              <Button title={armed(m.id) ? 'Sure?' : 'Remove'} variant={armed(m.id) ? 'destructive' : 'tertiary'} size="sm" loading={busy === m.id} onClick={() => remove(m.id, m.display_name)} />
            ) : m.id === g.created_by ? (
              <Txt variant="footnote" tone="tertiary" as="span">
                Made it
              </Txt>
            ) : null;
          return <ListRow key={m.id} leading={<Avatar name={m.display_name} src={m.avatar_url} size={32} />} title={m.display_name} subtitle={`@${m.username}`} trailing={trailing} chevron={false} />;
        })}
      </GroupList>

      {creator ? (
        <Button title={armed('delete') ? 'Tap again to delete for everyone' : 'Delete circle'} variant={armed('delete') ? 'destructive' : 'tertiary'} size="lg" loading={busy === 'delete'} className="mt-5" onClick={destroy} />
      ) : (
        <Button title={armed('leave') ? 'Tap again to leave' : 'Leave circle'} variant={armed('leave') ? 'destructive' : 'tertiary'} size="lg" loading={busy === 'leave'} className="mt-5" onClick={leave} />
      )}
    </Sheet>
  );
}
