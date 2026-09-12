// "Leaving now" for my next class, and who among my friends is already on the way to it.
// Shown from 45 minutes before class until the posting window closes.
import { useState } from 'react';
import { IoCheckmark, IoWalkOutline } from 'react-icons/io5';
import { headOut } from '@/lib/api/presence';
import { useInvalidateState } from '@/lib/appState';
import { headingOutFor, listNames } from '@/lib/presence';
import { errorMessage } from '@/lib/supabase';
import type { FeedEvent, Occurrence } from '@/lib/types';
import { AvatarStack, Button, Icon, Txt, useToast } from '@/ui';

const SHOW_BEFORE_MS = 45 * 60_000;

export function HeadingOutRow({ occurrence: o, events, meId, nowMs, className }: { occurrence: Occurrence; events: FeedEvent[]; meId: string | null; nowMs: number; className?: string }) {
  const invalidate = useInvalidateState();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const starts = Date.parse(o.starts_at);
  const deadline = Date.parse(o.deadline);
  if (o.status !== 'pending' || nowMs < starts - SHOW_BEFORE_MS || nowMs > deadline) return null;

  const heading = headingOutFor(events, o, nowMs);
  const mine = heading.some((e) => e.actor_id === meId);
  const friends = heading.filter((e) => e.actor_id !== meId);
  const where = o.location_text ?? o.course_code;

  const go = async () => {
    setBusy(true);
    try {
      await headOut(o.id);
      await invalidate();
      toast(friends.length > 0 ? `On your way. ${listNames(friends.map((e) => e.payload.display_name ?? ''))} too.` : 'Your friends can see you are on your way');
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={className}>
      <div className="flex items-center gap-3 min-h-[44px]">
        <div className="flex-1 min-w-0 flex items-center gap-2">
          {friends.length > 0 ? (
            <>
              <AvatarStack people={friends.map((e) => ({ name: e.payload.display_name ?? '?', src: e.payload.avatar_url }))} size={24} />
              <Txt variant="footnote" tone="secondary" lines={2}>
                {listNames(friends.map((e) => e.payload.display_name ?? ''))} {friends.length === 1 ? 'is' : 'are'} on the way to {where}
              </Txt>
            </>
          ) : (
            <Txt variant="footnote" tone="tertiary" lines={2}>
              Nobody has left for {where} yet.
            </Txt>
          )}
        </div>
        {mine ? (
          <span className="inline-flex items-center gap-1 shrink-0">
            <Icon icon={IoCheckmark} size={16} className="text-success" />
            <Txt variant="footnote" tone="secondary">
              On your way
            </Txt>
          </span>
        ) : (
          <Button title="Leaving now" variant="secondary" size="sm" icon={IoWalkOutline} loading={busy} onClick={go} className="shrink-0" />
        )}
      </div>
    </div>
  );
}
