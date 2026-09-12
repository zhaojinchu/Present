// Stakes: what a miss costs in this circle, who currently owes it, and who has paid up. Any
// member except the one who owes can mark a forfeit paid.
import { useState } from 'react';
import { IoCheckmark } from 'react-icons/io5';
import { ProfileLink } from '@/components/ProfileLink';
import { markForfeitPaid } from '@/lib/api/groups';
import { useInvalidateState } from '@/lib/appState';
import { haptic } from '@/lib/haptics';
import { type Group, type GroupForfeit } from '@/lib/groups';
import { errorMessage } from '@/lib/supabase';
import { dayLabel } from '@/lib/time';
import { Avatar, Badge, Button, cx, Txt, useToast } from '@/ui';

export function Stakes({ group: g, meId, nowMs, className }: { group: Group; meId: string | null; nowMs: number; className?: string }) {
  const owed = g.forfeits.filter((f) => f.status === 'owed');
  const settled = g.forfeits.filter((f) => f.status !== 'owed');
  if (!g.forfeit_text) {
    return (
      <Txt variant="footnote" tone="tertiary" className={className}>
        No stakes in this circle.
      </Txt>
    );
  }
  return (
    <div className={cx('flex flex-col gap-2', className)}>
      <Txt variant="subhead" className="mb-1">
        A miss <span className="font-semibold">{g.forfeit_text}</span>.
      </Txt>
      {owed.length > 0 ? (
        <div className="bg-surface rounded-lg overflow-hidden">
          {owed.map((f, i) => (
            <ForfeitRow key={f.id} forfeit={f} group={g} meId={meId} nowMs={nowMs} first={i === 0} />
          ))}
        </div>
      ) : null}
      {settled.length > 0 ? (
        <Txt variant="footnote" tone="tertiary">
          {settled.filter((f) => f.status === 'paid').length} paid · {settled.filter((f) => f.status === 'voided').length} waived
        </Txt>
      ) : null}
    </div>
  );
}

function ForfeitRow({ forfeit: f, group: g, meId, nowMs, first }: { forfeit: GroupForfeit; group: Group; meId: string | null; nowMs: number; first: boolean }) {
  const invalidate = useInvalidateState();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const who = g.members.find((m) => m.id === f.user_id);
  const mine = f.user_id === meId;
  const pay = async () => {
    setBusy(true);
    haptic('light');
    try {
      await markForfeitPaid(f.id);
      await invalidate();
      haptic('success');
      toast(`${who?.display_name.split(' ')[0] ?? 'They'} paid up`);
    } catch (e) {
      haptic('error');
      toast(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={cx('flex items-center gap-3 px-4 min-h-[56px] py-2', !first && 'border-t border-border')}>
      <ProfileLink username={who?.username || null} label={who?.display_name} className="shrink-0">
        <Avatar name={who?.display_name ?? '?'} src={who?.avatar_url} size={32} />
      </ProfileLink>
      <div className="flex-1 min-w-0">
        <Txt variant="subhead" lines={1}>
          <span className="font-semibold">{mine ? 'You' : (who?.display_name ?? 'Someone').split(' ')[0]}</span> {mine ? 'owe' : 'owes'} the circle
        </Txt>
        <Txt variant="footnote" tone="secondary" lines={1}>
          missed {f.course_code} · {dayLabel(f.starts_at, nowMs)}
        </Txt>
      </div>
      {mine ? <Badge label="Owed" tone="warning" /> : <Button title="Mark paid" variant="secondary" size="sm" icon={IoCheckmark} loading={busy} onClick={pay} />}
    </div>
  );
}
