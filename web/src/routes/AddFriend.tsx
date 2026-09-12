// /add/:username — the landing for a shared link. Signed in: request now. Signed out: remember it,
// sign up, and the request goes out once the account exists (RootLayout).
import { useEffect, useState } from 'react';
import { IoCheckmark, IoPersonAddOutline } from 'react-icons/io5';
import { useNavigate, useParams } from 'react-router';
import { Main, Screen } from '@/app/AppShell';
import { sendFriendRequest } from '@/lib/api/social';
import { useInvalidateState, useSession } from '@/lib/appState';
import { prefs } from '@/lib/prefs';
import { errorMessage } from '@/lib/supabase';
import { Button, IconBadge, Spinner, Txt, Wordmark } from '@/ui';

export default function AddFriend() {
  const { username = '' } = useParams();
  const { userId, loading } = useSession();
  const navigate = useNavigate();
  const invalidate = useInvalidateState();
  const [state, setState] = useState<'working' | 'sent' | 'friends' | 'error'>('working');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!userId) {
      prefs.set('pending_add', username);
      navigate('/sign-up', { replace: true });
      return;
    }
    let alive = true;
    void (async () => {
      try {
        const r = await sendFriendRequest(username);
        await invalidate();
        if (alive) setState(r === 'friends' ? 'friends' : 'sent');
      } catch (e) {
        if (alive) {
          setErr(errorMessage(e));
          setState('error');
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [loading, userId, username, navigate, invalidate]);

  return (
    <Screen>
      <Main className="safe-top">
        <div className="flex flex-col items-center text-center min-h-full justify-center py-10">
          <Wordmark size={28} className="mb-8" />
          {state === 'working' ? <Spinner size={24} className="text-text-tertiary" /> : null}
          {state === 'sent' ? (
            <>
              <IconBadge icon={IoPersonAddOutline} tone="accent" size={64} />
              <Txt variant="title" className="mt-4">
                Request sent to @{username}
              </Txt>
              <Txt variant="subhead" tone="secondary" className="mt-1">
                You'll see each other's posts once they accept.
              </Txt>
            </>
          ) : null}
          {state === 'friends' ? (
            <>
              <IconBadge icon={IoCheckmark} tone="success" size={64} />
              <Txt variant="title" className="mt-4">
                You and @{username} are friends
              </Txt>
            </>
          ) : null}
          {state === 'error' ? (
            <>
              <Txt variant="title">Could not add @{username}</Txt>
              <Txt variant="subhead" tone="danger" className="mt-1">
                {err}
              </Txt>
            </>
          ) : null}
          {state !== 'working' ? <Button title="Open Present" size="lg" className="mt-8" onClick={() => navigate('/', { replace: true })} /> : null}
        </div>
      </Main>
    </Screen>
  );
}
