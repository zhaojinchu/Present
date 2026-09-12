// /circles/new — name, emoji, stakes, and which friends to invite.
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Header, Main, Screen } from '@/app/AppShell';
import { addToGroup, createGroup } from '@/lib/api/groups';
import { useFriends, useInvalidateState } from '@/lib/appState';
import { env } from '@/lib/config';
import { FORFEIT_PRESETS, GROUP_EMOJI, GROUP_MAX_MEMBERS } from '@/lib/groups';
import { errorMessage } from '@/lib/supabase';
import { Avatar, Button, Chip, ErrorText, Field, Input, ListRow, Group as GroupList, Txt } from '@/ui';
import { BackButton } from './_Stub';

export default function CircleNew() {
  const navigate = useNavigate();
  const { friends } = useFriends();
  const invalidate = useInvalidateState();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState<string | null>(GROUP_EMOJI[0]);
  const [stake, setStake] = useState<string | 'custom' | null>(FORFEIT_PRESETS[0]);
  const [custom, setCustom] = useState('');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const forfeitText = stake === 'custom' ? custom.trim() || null : stake;
  const canSubmit = name.trim().length > 0 && !busy;
  const room = GROUP_MAX_MEMBERS - 1 - selected.size;

  const toggle = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else if (next.size < GROUP_MAX_MEMBERS - 1) next.add(id);
      return next;
    });
  };

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const g = await createGroup(name.trim(), emoji, forfeitText);
      if (g?.id) {
        await Promise.allSettled([...selected].map((id) => addToGroup(g.id, id)));
      }
      await invalidate();
      navigate(g?.id ? `/circles/${g.id}` : env.mockState ? '/circles/group-hack-house' : '/circles', { replace: true });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header title="New circle" left={<BackButton />} />
      <Main>
        <div className="flex flex-col gap-5 mt-2">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} placeholder="Hack House" autoCapitalize="words" autoFocus />
          </Field>

          <div className="flex flex-col gap-1.5">
            <Txt variant="footnote" tone="secondary" weight={600}>
              Emoji
            </Txt>
            <div className="flex gap-2 flex-wrap">
              {GROUP_EMOJI.map((e) => (
                <Chip key={e} label={e} selected={emoji === e} onClick={() => setEmoji(emoji === e ? null : e)} />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Txt variant="footnote" tone="secondary" weight={600}>
              Stakes
            </Txt>
            <div className="flex gap-2 flex-wrap">
              {FORFEIT_PRESETS.map((p) => (
                <Chip key={p} label={p} selected={stake === p} onClick={() => setStake(p)} />
              ))}
              <Chip label="Custom" selected={stake === 'custom'} onClick={() => setStake('custom')} />
              <Chip label="No stakes" selected={stake === null} onClick={() => setStake(null)} />
            </div>
            {stake === 'custom' ? <Input value={custom} onChange={(e) => setCustom(e.target.value.slice(0, 80))} placeholder="e.g. carries everyone's bags to class" autoFocus /> : null}
          </div>

          {friends.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Txt variant="footnote" tone="secondary" weight={600}>
                  Invite friends
                </Txt>
                <Txt variant="footnote" tone="tertiary" tabular>
                  {selected.size} selected{room <= 2 ? ` · ${room} more fit` : ''}
                </Txt>
              </div>
              <GroupList>
                {friends.map((f) => {
                  const on = selected.has(f.id);
                  return (
                    <ListRow key={f.id} leading={<Avatar name={f.display_name} src={f.avatar_url} size={32} />} title={f.display_name} subtitle={`@${f.username}`} trailing={<Chip label={on ? 'Invited' : 'Invite'} selected={on} onClick={() => toggle(f.id)} />} chevron={false} />
                  );
                })}
              </GroupList>
            </div>
          ) : (
            <Txt variant="footnote" tone="tertiary">
              No friends yet. Share the code after creating it.
            </Txt>
          )}

          <ErrorText>{error}</ErrorText>
          <Button title="Create circle" size="lg" loading={busy} disabled={!canSubmit} onClick={submit} className="mb-8" />
        </div>
      </Main>
    </Screen>
  );
}
