// /explain/:missId — one line to your friends, or "I was sick" which excuses the miss.
import { useState, type FormEvent } from 'react';
import { IoChatbubbleOutline, IoMedkitOutline } from 'react-icons/io5';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { Header, Main, Screen } from '@/app/AppShell';
import { excuseMiss, explainMiss } from '@/lib/api/social';
import { useAppState, useInvalidateState } from '@/lib/appState';
import { EXPLANATION_MAX } from '@/lib/config';
import { errorMessage } from '@/lib/supabase';
import { fmtTime } from '@/lib/time';
import { Button, ErrorText, IconBadge, TextArea, Txt } from '@/ui';
import { BackButton } from './_Stub';

export default function Explain() {
  const { missId = '' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const q = useAppState();
  const invalidate = useInvalidateState();
  const miss = (q.data?.my_unexplained_misses ?? []).find((m) => m.id === missId) ?? null;
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<'explain' | 'excuse' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const excuseFirst = params.get('excuse') === '1';

  const done = () => (window.history.length > 1 ? navigate(-1) : navigate('/', { replace: true }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy('explain');
    setErr(null);
    try {
      await explainMiss(missId, text.trim());
      await invalidate();
      done();
    } catch (x) {
      setErr(errorMessage(x));
      setBusy(null);
    }
  };
  const excuse = async () => {
    setBusy('excuse');
    setErr(null);
    try {
      await excuseMiss(missId, text.trim() || undefined);
      await invalidate();
      done();
    } catch (x) {
      setErr(errorMessage(x));
      setBusy(null);
    }
  };

  return (
    <Screen>
      <Header title="Explain yourself" left={<BackButton />} />
      <Main>
        <div className="flex flex-col items-center text-center mt-6">
          <IconBadge icon={IoChatbubbleOutline} tone="danger" size={64} />
          <Txt variant="title" className="mt-4">
            {miss ? `You missed ${miss.course_code}` : 'You missed a class'}
          </Txt>
          <Txt variant="subhead" tone="secondary" className="mt-1">
            {miss ? `${fmtTime(miss.starts_at)}. Your friends saw it. One line, under the miss.` : 'Your friends saw it. One line, under the miss.'}
          </Txt>
        </div>
        <form onSubmit={submit} className="mt-8 flex flex-col gap-3">
          <TextArea value={text} onChange={(e) => setText(e.target.value.slice(0, EXPLANATION_MAX))} placeholder="slept in, no regrets" maxLength={EXPLANATION_MAX} autoFocus={!excuseFirst} />
          <Txt variant="footnote" tone="tertiary" align="right" tabular>
            {text.length}/{EXPLANATION_MAX}
          </Txt>
          <Button type="submit" title="Post explanation" size="lg" loading={busy === 'explain'} disabled={!text.trim() || busy === 'excuse'} />
          <Button title="It was sick or an emergency" variant={excuseFirst ? 'primary' : 'secondary'} size="lg" icon={IoMedkitOutline} loading={busy === 'excuse'} disabled={busy === 'explain'} onClick={excuse} />
          <Button title="Later" variant="tertiary" size="lg" onClick={done} disabled={!!busy} />
          <ErrorText>{err}</ErrorText>
          <Txt variant="footnote" tone="tertiary" align="center" className="mt-2">
            An excused miss does not break your streak. Whatever you typed goes under the miss either way.
          </Txt>
        </form>
      </Main>
    </Screen>
  );
}
