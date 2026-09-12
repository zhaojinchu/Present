// /friends — search, requests, and the friends list ordered by streak (the leaderboard).
import { useEffect, useState } from 'react';
import { IoQrCodeOutline, IoSearch } from 'react-icons/io5';
import { useNavigate, useSearchParams } from 'react-router';
import { Header, Main, Screen } from '@/app/AppShell';
import { FriendRow } from '@/components/friends/FriendRow';
import { searchUsers } from '@/lib/api/social';
import { useFriends, useMe } from '@/lib/appState';
import type { SearchUser } from '@/lib/types';
import { Button, Icon, IconButton, Input, Spinner, Txt } from '@/ui';
import { BackButton } from './_Stub';

export default function Friends() {
  const [params] = useSearchParams();
  const onboarding = params.get('onboarding') === '1';
  const navigate = useNavigate();
  const me = useMe();
  const { friends, requests } = useFriends();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchUser[] | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim().replace(/^@/, '');
    if (q.length < 1) {
      setResults(null);
      return;
    }
    setSearching(true);
    const t = window.setTimeout(async () => {
      try {
        setResults(await searchUsers(q));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => window.clearTimeout(t);
  }, [query]);

  const friendRank = new Map(friends.map((f, i) => [f.id, i + 1]));

  return (
    <Screen>
      <Header
        title={onboarding ? 'Add friends' : 'Friends'}
        left={onboarding ? undefined : <BackButton />}
        right={<IconButton icon={IoQrCodeOutline} label="Share my link" tone="plain" onClick={() => navigate('/friends/share')} />}
      />
      <Main padded={false}>
        <div className="px-4 pt-1 pb-3">
          <div className="relative">
            <Icon icon={IoSearch} size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by username or name" autoCapitalize="none" autoCorrect="off" spellCheck={false} className="!pl-11" />
            {searching ? <Spinner size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-text-tertiary" /> : null}
          </div>
        </div>

        {results ? (
          <section>
            <Txt variant="label" tone="tertiary" className="px-4 pb-1">
              Results
            </Txt>
            {results.length === 0 && !searching ? (
              <Txt variant="subhead" tone="tertiary" className="px-4 py-3">
                No one by that name. Send them your link.
              </Txt>
            ) : null}
            {results.map((u) => (
              <FriendRow key={u.id} id={u.id} username={u.username} displayName={u.display_name} avatarUrl={u.avatar_url} relation={u.relation} streak={undefined} rank={undefined} />
            ))}
            <div className="hairline mx-4 my-2" />
          </section>
        ) : null}

        {requests.incoming.length > 0 ? (
          <section>
            <Txt variant="label" tone="tertiary" className="px-4 pt-3 pb-1">
              Requests
            </Txt>
            {requests.incoming.map((r) => (
              <FriendRow key={r.id} id={r.id} username={r.username} displayName={r.display_name} avatarUrl={r.avatar_url} relation="incoming" />
            ))}
          </section>
        ) : null}
        {requests.outgoing.length > 0 ? (
          <section>
            <Txt variant="label" tone="tertiary" className="px-4 pt-3 pb-1">
              Sent
            </Txt>
            {requests.outgoing.map((r) => (
              <FriendRow key={r.id} id={r.id} username={r.username} displayName={r.display_name} avatarUrl={r.avatar_url} relation="outgoing" />
            ))}
          </section>
        ) : null}

        <section>
          <Txt variant="label" tone="tertiary" className="px-4 pt-3 pb-1">
            {friends.length === 0 ? 'Friends' : `Friends · ${friends.length}`}
          </Txt>
          {friends.length === 0 ? (
            <Txt variant="subhead" tone="tertiary" className="px-4 py-3">
              Search for someone, or share your link.
            </Txt>
          ) : null}
          {friends.map((f) => (
            <FriendRow key={f.id} id={f.id} username={f.username} displayName={f.display_name} avatarUrl={f.avatar_url} relation="friends" streak={f.streak} rank={friendRank.get(f.id)} subtitle={f.posted_today ? 'posted today' : `@${f.username}`} />
          ))}
          {me && friends.length > 0 ? (
            <Txt variant="footnote" tone="tertiary" className="px-4 pt-2 pb-4">
              You are at {me.streak} with a best of {me.best_streak}.
            </Txt>
          ) : null}
        </section>
        <div className="h-24" />
      </Main>
      {onboarding ? (
        <div className="safe-bottom shrink-0 px-4 pb-3 pt-2 bg-bg">
          <Button title={friends.length > 0 || requests.outgoing.length > 0 ? 'Continue' : 'Continue without friends'} size="lg" onClick={() => navigate('/today', { replace: true })} />
        </div>
      ) : null}
    </Screen>
  );
}
