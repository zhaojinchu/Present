// /circles/join?code=ABC123 — join a circle by its 6-character code.
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Header, Main, Screen } from '@/app/AppShell';
import { joinGroup } from '@/lib/api/groups';
import { useInvalidateState } from '@/lib/appState';
import { env } from '@/lib/config';
import { errorMessage } from '@/lib/supabase';
import { Button, ErrorText, Field, Input } from '@/ui';
import { BackButton } from './_Stub';

export default function CircleJoin() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const invalidate = useInvalidateState();
  const [code, setCode] = useState((params.get('code') ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (code.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const g = await joinGroup(code);
      await invalidate();
      navigate(g?.id ? `/circles/${g.id}` : env.mockState ? '/circles/group-hack-house' : '/circles', { replace: true });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  // A link with the code: try at once.
  useEffect(() => {
    if (params.get('code') && code.length === 6) void submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Screen>
      <Header title="Join a circle" left={<BackButton />} />
      <Main>
        <div className="flex flex-col gap-5 mt-2">
          <Field label="Invite code">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              placeholder="ABC123"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              inputMode="text"
              className="text-title text-center tracking-[6px] h-[60px]"
              autoFocus={!params.get('code')}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </Field>
          <ErrorText>{error}</ErrorText>
          <Button title="Join circle" size="lg" loading={busy} disabled={code.length !== 6 || busy} onClick={submit} />
        </div>
      </Main>
    </Screen>
  );
}
