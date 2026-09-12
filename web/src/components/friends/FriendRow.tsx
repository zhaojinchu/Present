// A person with the one action their relation allows.
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { acceptFriendRequest, removeFriend, sendFriendRequest } from '@/lib/api/social';
import { useInvalidateState } from '@/lib/appState';
import { haptic } from '@/lib/haptics';
import type { Relation } from '@/lib/types';
import { Avatar, Button, ListRow, StreakChip, useToast } from '@/ui';

export function FriendRow({
  id,
  username,
  displayName,
  avatarUrl,
  relation,
  streak,
  rank,
  subtitle,
}: {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  relation: Relation;
  streak?: number;
  rank?: number;
  subtitle?: string;
}) {
  const navigate = useNavigate();
  const invalidate = useInvalidateState();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState<Relation | null>(null);
  const rel = local ?? relation;

  const act = async (fn: () => Promise<unknown>, next: Relation, msg?: string) => {
    setBusy(true);
    try {
      await fn();
      haptic('success');
      setLocal(next);
      if (msg) toast(msg);
      await invalidate();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const trailing =
    rel === 'friends' ? (
      typeof streak === 'number' ? <StreakChip value={streak} size="sm" /> : <Button title="Friends" variant="tertiary" size="sm" disabled />
    ) : rel === 'incoming' ? (
      <span className="flex gap-1.5">
        <Button title="Accept" size="sm" loading={busy} onClick={() => act(() => acceptFriendRequest(id), 'friends', `You and ${displayName.split(' ')[0]} are friends`)} />
        <Button title="Decline" variant="tertiary" size="sm" disabled={busy} onClick={() => act(() => removeFriend(id), 'none')} />
      </span>
    ) : rel === 'outgoing' ? (
      <Button title="Requested" variant="secondary" size="sm" loading={busy} onClick={() => act(() => removeFriend(id), 'none', 'Request cancelled')} />
    ) : (
      <Button title="Add" size="sm" loading={busy} onClick={() => act(async () => (await sendFriendRequest(username)) === 'friends' ? 'friends' : 'outgoing', 'outgoing').then(() => undefined)} />
    );

  return (
    <ListRow
      leading={
        <span className="flex items-center gap-2">
          {typeof rank === 'number' ? <span className="w-5 text-footnote tabular text-text-tertiary text-right">{rank}</span> : null}
          <Avatar name={displayName} src={avatarUrl} size={40} />
        </span>
      }
      title={displayName}
      subtitle={subtitle ?? `@${username}`}
      trailing={trailing}
      onClick={rel === 'friends' ? () => navigate(`/u/${username}`) : undefined}
      chevron={false}
    />
  );
}
