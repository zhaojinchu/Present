// Friends in the same class session who have not posted yet, each with a Nudge button. Shown
// from 15 minutes before class until the posting window closes. One nudge per friend per class.
import { useState } from 'react';
import { IoHandLeftOutline } from 'react-icons/io5';
import { nudge } from '@/lib/api/presence';
import { useInvalidateState } from '@/lib/appState';
import { alreadyNudged, firstName, pendingFriendsFor } from '@/lib/presence';
import { errorMessage } from '@/lib/supabase';
import type { FeedEvent, Occurrence } from '@/lib/types';
import { Avatar, Button, Txt, useToast } from '@/ui';

const SHOW_BEFORE_MS = 15 * 60_000;

export function NudgeRow({
  session,
  theirs,
  events,
  meId,
  nowMs,
  className,
}: {
  /** The class session (mine, or the one I am looking at). */
  session: { course_code: string; starts_at: string; deadline: string };
  /** Friends' occurrences today. */
  theirs: Occurrence[];
  events: FeedEvent[];
  meId: string | null;
  nowMs: number;
  className?: string;
}) {
  const invalidate = useInvalidateState();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [sent, setSent] = useState<Set<string>>(() => new Set());

  const starts = Date.parse(session.starts_at);
  const deadline = Date.parse(session.deadline);
  if (nowMs < starts - SHOW_BEFORE_MS || nowMs > deadline) return null;
  const pending = pendingFriendsFor(theirs, session);
  if (pending.length === 0) return null;

  const poke = async (o: Occurrence) => {
    setBusy(o.id);
    try {
      await nudge(o.id);
      setSent((s) => new Set(s).add(o.id));
      await invalidate();
      toast(`Nudged ${firstName(o.display_name)}`);
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={className}>
      <Txt variant="footnote" tone="tertiary" className="mb-1.5">
        {pending.length === 1 ? `${firstName(pending[0].display_name)} hasn't posted from ${session.course_code} yet` : `${pending.length} friends haven't posted from ${session.course_code} yet`}
      </Txt>
      <div className="flex flex-col">
        {pending.map((o) => {
          const done = sent.has(o.id) || alreadyNudged(events, meId, o.id);
          return (
            <div key={o.id} className="flex items-center gap-3 min-h-[44px]">
              <Avatar name={o.display_name} src={o.avatar_url} size={32} />
              <Txt variant="subhead" className="flex-1 min-w-0" lines={1}>
                {o.display_name}
              </Txt>
              <Button title={done ? 'Nudged' : 'Nudge'} variant="secondary" size="sm" icon={IoHandLeftOutline} disabled={done} loading={busy === o.id} onClick={() => poke(o)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
