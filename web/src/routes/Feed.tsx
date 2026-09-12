// The home tab: who showed up, in photos.
import { useMemo } from 'react';
import { IoPeopleOutline } from 'react-icons/io5';
import { useNavigate } from 'react-router';
import { Header, Main, Screen } from '@/app/AppShell';
import { FeedList } from '@/components/feed/FeedList';
import { InstallHint } from '@/components/InstallHint';
import { LiveRow } from '@/components/feed/LiveRow';
import { PromptCard } from '@/components/today/PromptCard';
import { useAppState, useFeed, useFriends, useToday } from '@/lib/appState';
import { useNow } from '@/lib/clock';
import { inClassNow } from '@/lib/phase';
import { IconButton, Txt } from '@/ui';

export default function Feed() {
  const now = useNow(1000);
  const navigate = useNavigate();
  const q = useAppState();
  const { events, reactions, comments, loading, me } = useFeed();
  const { friends, requests } = useFriends();
  const { theirs, focus } = useToday(now);
  const inClass = useMemo(() => theirs.filter((t) => inClassNow(t.occurrence, now)).map((t) => t.occurrence), [theirs, now]);
  const nextUp = useMemo(() => {
    const upcoming = theirs.filter((t) => t.phase === 'upcoming').map((t) => t.occurrence);
    upcoming.sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
    return upcoming[0] ?? null;
  }, [theirs]);
  const unexplained = useMemo(() => new Set((q.data?.my_unexplained_misses ?? []).map((m) => m.id)), [q.data]);
  const friendsPostedForFocus = useMemo(
    () => (focus ? theirs.filter((t) => t.occurrence.course_code === focus.occurrence.course_code && t.occurrence.status === 'posted').map((t) => t.occurrence) : []),
    [theirs, focus],
  );

  return (
    <Screen tabs>
      <Header
        title="Present"
        large
        right={
          <span className="relative">
            <IconButton icon={IoPeopleOutline} label="Friends" tone="plain" onClick={() => navigate('/friends')} />
            {requests.incoming.length > 0 ? <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-danger" aria-label={`${requests.incoming.length} requests`} /> : null}
          </span>
        }
      />
      <Main padded={false}>
        <InstallHint />
        {focus && (focus.phase === 'open' || focus.phase === 'late') ? (
          <div className="mb-2">
            <PromptCard occurrence={focus.occurrence} phase={focus.phase} nowMs={now} friendsPosted={friendsPostedForFocus} compact />
          </div>
        ) : null}
        <LiveRow inClass={inClass} />
        {q.error && events.length === 0 ? (
          <Txt variant="footnote" tone="danger" className="px-4 pt-4">
            Couldn't reach the server. Retrying.
          </Txt>
        ) : null}
        <FeedList events={events} reactions={reactions} comments={comments} meId={me?.id ?? null} nowMs={now} loading={loading} friendsCount={friends.length} unexplainedMissIds={unexplained} nextUp={nextUp} />
      </Main>
    </Screen>
  );
}
