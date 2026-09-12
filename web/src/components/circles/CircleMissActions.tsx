// What a circle does with a miss: the stake it triggered, the excuse vote (majority of the other
// members excuses it), and a vouch ("I saw them", one is enough). Rendered under a miss card. In
// circle view it carries the buttons; in the Everyone view it is one summary line per shared circle.
import { useState } from 'react';
import { IoCheckmark, IoEyeOutline, IoThumbsDown, IoThumbsDownOutline, IoThumbsUp, IoThumbsUpOutline } from 'react-icons/io5';
import { useNavigate } from 'react-router';
import { markForfeitPaid, voteMiss, vouchMiss } from '@/lib/api/groups';
import { useInvalidateState } from '@/lib/appState';
import { haptic } from '@/lib/haptics';
import { groupLabel, groupsSharedWith, missInGroup, type Group } from '@/lib/groups';
import { errorMessage } from '@/lib/supabase';
import { Badge, Button, cx, Icon, Txt, useToast } from '@/ui';

export function CircleMissActions({
  missId,
  actorId,
  group,
  groups,
  meId,
  className,
}: {
  missId: string;
  actorId: string;
  /** The circle whose feed is being viewed, if any. */
  group: Group | null;
  /** All my circles, for the summary lines in the Everyone view. */
  groups: Group[];
  meId: string | null;
  className?: string;
}) {
  if (group) {
    if (!group.members.some((m) => m.id === actorId)) return null;
    return <Actions missId={missId} actorId={actorId} group={group} meId={meId} className={className} />;
  }
  const shared = groupsSharedWith(groups, actorId);
  if (shared.length === 0) return null;
  return (
    <div className={cx('flex flex-col gap-1', className)}>
      {shared.map((g) => (
        <Summary key={g.id} missId={missId} group={g} meId={meId} />
      ))}
    </div>
  );
}

function Summary({ missId, group: g, meId }: { missId: string; group: Group; meId: string | null }) {
  const navigate = useNavigate();
  const m = missInGroup(g, missId, meId);
  const parts: string[] = [];
  if (m.excused) parts.push('excused by the circle');
  else if (m.forfeit?.status === 'owed') parts.push(`owes: ${g.forfeit_text ?? 'the forfeit'}`);
  else if (m.forfeit?.status === 'paid') parts.push('paid up');
  if (m.fair + m.unfair > 0) parts.push(`${m.fair} fair · ${m.unfair} not`);
  if (m.vouchers.length > 0) parts.push(`vouched`);
  if (parts.length === 0) return null;
  return (
    <button type="button" onClick={() => navigate(`/circles/${g.id}`)} className="text-left">
      <Txt variant="footnote" tone="secondary" lines={1}>
        <span className="font-semibold text-text">{groupLabel(g)}</span> · {parts.join(' · ')}
      </Txt>
    </button>
  );
}

function Actions({ missId, actorId, group: g, meId, className }: { missId: string; actorId: string; group: Group; meId: string | null; className?: string }) {
  const invalidate = useInvalidateState();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const m = missInGroup(g, missId, meId);
  const isMisser = actorId === meId;
  const byId = new Map(g.members.map((x) => [x.id, x]));
  const misser = byId.get(actorId);
  const first = (misser?.display_name ?? 'They').split(' ')[0];

  const run = async (key: string, fn: () => Promise<unknown>, done?: string) => {
    setBusy(key);
    haptic('light');
    try {
      await fn();
      await invalidate();
      haptic('success');
      if (done) toast(done);
    } catch (e) {
      haptic('error');
      toast(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={cx('flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <Txt variant="footnote" tone="tertiary" lines={1}>
          {groupLabel(g)}
        </Txt>
        {m.excused ? <Badge label="Excused by the circle" tone="info" icon={IoCheckmark} /> : null}
      </div>

      {g.forfeit_text ? (
        <div className="flex items-center justify-between gap-2">
          <Txt variant="subhead" lines={2}>
            {m.forfeit?.status === 'paid' ? (
              <>
                <span className="font-semibold">{isMisser ? 'You' : first}</span> paid: {g.forfeit_text}
              </>
            ) : m.forfeit?.status === 'voided' || m.excused ? (
              <span className="text-text-secondary">Stake waived.</span>
            ) : (
              <>
                <span className="font-semibold">{isMisser ? 'You' : first}</span> {isMisser ? 'owe' : 'owes'} the circle: {g.forfeit_text}
              </>
            )}
          </Txt>
          {m.forfeit?.status === 'owed' && !isMisser ? <Button title="Mark paid" variant="secondary" size="sm" icon={IoCheckmark} loading={busy === 'pay'} onClick={() => run('pay', () => markForfeitPaid(m.forfeit!.id), `${first} paid up`)} /> : null}
        </div>
      ) : null}

      {!isMisser && !m.excused ? (
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            title={`Fair enough${m.fair > 0 ? ` · ${m.fair}` : ''}`}
            variant={m.myVote === true ? 'primary' : 'secondary'}
            size="sm"
            icon={m.myVote === true ? IoThumbsUp : IoThumbsUpOutline}
            loading={busy === 'fair'}
            onClick={() => run('fair', () => voteMiss(missId, g.id, true))}
          />
          <Button
            title={`Not buying it${m.unfair > 0 ? ` · ${m.unfair}` : ''}`}
            variant={m.myVote === false ? 'primary' : 'secondary'}
            size="sm"
            icon={m.myVote === false ? IoThumbsDown : IoThumbsDownOutline}
            loading={busy === 'unfair'}
            onClick={() => run('unfair', () => voteMiss(missId, g.id, false))}
          />
          <Button title="I saw them" variant="tertiary" size="sm" icon={IoEyeOutline} loading={busy === 'vouch'} onClick={() => run('vouch', () => vouchMiss(missId, g.id), `You vouched for ${first}`)} />
        </div>
      ) : null}

      {isMisser && !m.excused ? (
        <Txt variant="footnote" tone="secondary" tabular>
          {m.fair} of {m.needed} say fair enough{m.unfair > 0 ? ` · ${m.unfair} not buying it` : ''}
        </Txt>
      ) : null}

      {m.vouchers.length > 0 ? (
        <span className="flex items-center gap-1">
          <Icon icon={IoEyeOutline} size={14} className="text-text-tertiary" />
          <Txt variant="footnote" tone="tertiary" lines={1}>
            Vouched by {m.vouchers.map((id) => (byId.get(id)?.display_name ?? 'someone').split(' ')[0]).join(', ')}
          </Txt>
        </span>
      ) : null}
    </div>
  );
}
