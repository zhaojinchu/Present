// /u/:username — a friend's profile: streak, their classes today, their posts from the last day.
import { useMemo, useState } from 'react';
import { IoFlame, IoFlameOutline } from 'react-icons/io5';
import { useNavigate, useParams } from 'react-router';
import { Header, Main, Screen } from '@/app/AppShell';
import { ClassRow } from '@/components/today/ClassRow';
import { FeedList } from '@/components/feed/FeedList';
import { removeFriend, sendFriendRequest } from '@/lib/api/social';
import { useAppState, useInvalidateState, useToday } from '@/lib/appState';
import { useNow } from '@/lib/clock';
import { Avatar, Button, Group, Stat, Txt, useToast } from '@/ui';
import { BackButton } from './_Stub';

export default function UserProfile() {
  const { username = '' } = useParams();
  const now = useNow(1000);
  const navigate = useNavigate();
  const q = useAppState();
  const invalidate = useInvalidateState();
  const toast = useToast();
  const { theirs } = useToday(now);
  const friend = (q.data?.friends ?? []).find((f) => f.username === username) ?? null;
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const todayRows = useMemo(() => theirs.filter((t) => t.occurrence.username === username), [theirs, username]);
  const posts = useMemo(() => (q.data?.feed ?? []).filter((e) => e.type === 'post' && e.payload.username === username && Date.parse(e.created_at) > now - 24 * 3_600_000), [q.data, username, now]);

  const remove = async () => {
    if (!friend) return;
    if (!confirm) {
      setConfirm(true);
      window.setTimeout(() => setConfirm(false), 3000);
      return;
    }
    setBusy(true);
    try {
      await removeFriend(friend.id);
      await invalidate();
      toast(`Removed @${username}`);
      navigate(-1);
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    setBusy(true);
    try {
      const r = await sendFriendRequest(username);
      await invalidate();
      toast(r === 'friends' ? `You and @${username} are friends` : `Request sent to @${username}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header title={`@${username}`} left={<BackButton />} />
      <Main padded={false}>
        {friend ? (
          <>
            <div className="flex items-center gap-4 px-4 pt-2">
              <Avatar name={friend.display_name} src={friend.avatar_url} size={72} />
              <div className="min-w-0">
                <Txt variant="title" lines={1}>
                  {friend.display_name}
                </Txt>
                <Txt variant="subhead" tone="secondary">
                  @{friend.username}
                  {friend.posted_today ? ' · posted today' : ''}
                </Txt>
              </div>
            </div>
            <div className="flex gap-6 px-4 mt-5">
              <Stat size="lg" value={friend.streak} label={friend.streak > 0 ? 'Day streak' : 'Streak lost'} icon={friend.streak > 0 ? IoFlame : IoFlameOutline} iconClassName={friend.streak > 0 ? 'text-ember' : 'text-danger'} tone={friend.streak > 0 ? 'primary' : 'danger'} />
              <Stat value={friend.best_streak} label="Best" />
            </div>
            {todayRows.length > 0 ? (
              <div className="px-4 mt-6">
                <Txt variant="label" tone="tertiary" className="mb-2">
                  Today
                </Txt>
                <Group>
                  {todayRows.map((t) => (
                    <ClassRow key={t.occurrence.id} occurrence={t.occurrence} phase={t.phase} />
                  ))}
                </Group>
              </div>
            ) : null}
            <Txt variant="label" tone="tertiary" className="px-4 mt-6">
              Last 24 hours
            </Txt>
            {posts.length === 0 ? (
              <Txt variant="subhead" tone="tertiary" className="px-4 py-3">
                Nothing posted in the last day.
              </Txt>
            ) : (
              <FeedList events={posts} reactions={q.data?.reactions ?? []} comments={q.data?.comments ?? []} meId={q.data?.me.id ?? null} nowMs={now} loading={false} friendsCount={1} unexplainedMissIds={new Set()} nextUp={null} />
            )}
            <div className="px-4 mt-4 mb-8">
              <Button title={confirm ? 'Tap again to remove' : 'Remove friend'} variant="destructive" size="lg" loading={busy} onClick={remove} />
            </div>
          </>
        ) : (
          <div className="px-4 pt-10 flex flex-col items-center text-center">
            <Avatar name={username} size={72} />
            <Txt variant="title" className="mt-4">
              @{username}
            </Txt>
            <Txt variant="subhead" tone="secondary" className="mt-1">
              You are not friends yet.
            </Txt>
            <Button title="Add friend" size="lg" className="mt-6" loading={busy} onClick={add} />
          </div>
        )}
      </Main>
    </Screen>
  );
}
