// /circles/:circleId/edit — name, emoji and stakes. Creator only; the server enforces it too.
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Header, Main, Screen } from '@/app/AppShell';
import { EmojiField, StakesField, stakeFromText, stakeText, type StakeChoice } from '@/components/circles/CircleFields';
import { updateGroup } from '@/lib/api/groups';
import { useAppState, useInvalidateState, useMe } from '@/lib/appState';
import { haptic } from '@/lib/haptics';
import { errorMessage } from '@/lib/supabase';
import { Button, ErrorText, Field, Input, Txt } from '@/ui';
import { BackButton } from './_Stub';

export default function CircleEdit() {
  const { circleId } = useParams<{ circleId: string }>();
  const navigate = useNavigate();
  const q = useAppState();
  const me = useMe();
  const invalidate = useInvalidateState();
  const g = q.data?.groups.find((x) => x.id === circleId) ?? null;
  return g ? <Form key={g.id} group={g} creator={g.created_by === me?.id} onDone={() => navigate(-1)} invalidate={invalidate} /> : (
    <Screen>
      <Header title="Edit circle" left={<BackButton />} />
      <Main>
        <Txt variant="subhead" tone="secondary" className="mt-4">
          {q.isPending ? 'Loading…' : 'This circle is not on your list.'}
        </Txt>
      </Main>
    </Screen>
  );
}

function Form({ group: g, creator, onDone, invalidate }: { group: { id: string; name: string; emoji: string | null; forfeit_text: string | null }; creator: boolean; onDone: () => void; invalidate: () => Promise<unknown> }) {
  const initial = stakeFromText(g.forfeit_text);
  const [name, setName] = useState(g.name);
  const [emoji, setEmoji] = useState<string | null>(g.emoji);
  const [stake, setStake] = useState<StakeChoice>(initial.stake);
  const [custom, setCustom] = useState(initial.custom);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSubmit = creator && name.trim().length > 0 && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    haptic('light');
    try {
      // update_group clears emoji / stakes when they are null, so always send all three.
      await updateGroup(g.id, { name: name.trim(), emoji, forfeit_text: stakeText(stake, custom) });
      await invalidate();
      haptic('success');
      onDone();
    } catch (e) {
      haptic('error');
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header title="Edit circle" left={<BackButton />} />
      <Main>
        <div className="flex flex-col gap-5 mt-2">
          {!creator ? (
            <Txt variant="footnote" tone="secondary">
              Only the person who made the circle can change it.
            </Txt>
          ) : null}
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} autoCapitalize="words" disabled={!creator} />
          </Field>
          <EmojiField value={emoji} onChange={setEmoji} />
          <StakesField stake={stake} custom={custom} onStake={setStake} onCustom={setCustom} />
          <ErrorText>{error}</ErrorText>
          <Button title="Save" size="lg" loading={busy} disabled={!canSubmit} onClick={submit} className="mb-8" />
        </div>
      </Main>
    </Screen>
  );
}
