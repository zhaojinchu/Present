// /comments/:eventId — the thread under a post or a miss.
import { useState, type FormEvent } from 'react';
import { useParams } from 'react-router';
import { Header, Main, Screen } from '@/app/AppShell';
import { ProfileLink } from '@/components/ProfileLink';
import { addComment } from '@/lib/api/social';
import { useAppState, useInvalidateState } from '@/lib/appState';
import { useNow } from '@/lib/clock';
import { COMMENT_MAX } from '@/lib/config';
import { commentsFor } from '@/lib/feed';
import { errorMessage } from '@/lib/supabase';
import { relative } from '@/lib/time';
import { Avatar, Button, ErrorText, Input, Strong, Txt } from '@/ui';
import { BackButton } from './_Stub';

export default function Comments() {
  const { eventId = '' } = useParams();
  const now = useNow(30_000);
  const q = useAppState();
  const invalidate = useInvalidateState();
  const comments = commentsFor(q.data?.comments ?? [], eventId);
  const event = (q.data?.feed ?? []).find((e) => e.id === eventId);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await addComment(eventId, text.trim());
      setText('');
      await invalidate();
    } catch (x) {
      setErr(errorMessage(x));
    } finally {
      setBusy(false);
    }
  };

  const title = event?.type === 'miss' ? `${event.payload.display_name?.split(' ')[0]} missed ${event.payload.course_code}` : event ? `${event.payload.display_name?.split(' ')[0]} · ${event.payload.course_code}` : 'Comments';

  return (
    <Screen>
      <Header title={title} left={<BackButton />} />
      <Main padded={false}>
        {comments.length === 0 ? (
          <Txt variant="subhead" tone="tertiary" align="center" className="py-10">
            No comments yet.
          </Txt>
        ) : null}
        {comments.map((c) => (
          <div key={c.id} className="flex items-start gap-3 px-4 py-3">
            <ProfileLink username={c.username} label={c.display_name}>
              <Avatar name={c.display_name} size={32} />
            </ProfileLink>
            <div className="flex-1 min-w-0">
              <Txt variant="subhead" className="selectable">
                <ProfileLink username={c.username} className="inline">
                  <Strong>{c.username}</Strong>
                </ProfileLink>{' '}
                {c.text}
              </Txt>
              <Txt variant="footnote" tone="tertiary">
                {relative(c.created_at, now)}
              </Txt>
            </div>
          </div>
        ))}
      </Main>
      <form onSubmit={submit} className="safe-bottom shrink-0 px-4 pt-2 pb-3 bg-bg">
        <div className="hairline -mx-4 mb-3" />
        <div className="flex gap-2">
          <Input value={text} onChange={(e) => setText(e.target.value.slice(0, COMMENT_MAX))} placeholder="Add a comment" maxLength={COMMENT_MAX} enterKeyHint="send" autoComplete="off" />
          <Button type="submit" title="Post" size="lg" block={false} loading={busy} disabled={!text.trim()} />
        </div>
        <ErrorText>{err}</ErrorText>
      </form>
    </Screen>
  );
}
