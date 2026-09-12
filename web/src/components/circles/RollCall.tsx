// Roll call: for every class session two or more circle members share today, who is present, late,
// missing or still to come. Fills in live as people present. Shows the session that matters now and
// folds the rest behind "Show N more" (no inner scroll: nested scrolling fights the page on iOS).
import { useState } from 'react';
import { IoCheckmark, IoChevronDown, IoChevronUp, IoClose } from 'react-icons/io5';
import { ProfileLink } from '@/components/ProfileLink';
import { phaseOf } from '@/lib/phase';
import { type Group, presentCount, rankRollCall, rollCall, type RollCallSession, sessionPhase } from '@/lib/groups';
import { fmtCountdown, fmtTime } from '@/lib/time';
import type { Occurrence } from '@/lib/types';
import { Avatar, Badge, Button, cx, Icon, Txt } from '@/ui';

export function RollCall({ group, today, nowMs, initial = 1, className }: { group: Group; today: Occurrence[]; nowMs: number; /** Sessions shown before "Show more". */ initial?: number; className?: string }) {
  const [expanded, setExpanded] = useState(false);
  const sessions = rankRollCall(rollCall(today, group), nowMs);
  if (sessions.length === 0) return null;
  const hidden = sessions.length - initial;
  const shown = expanded || hidden <= 0 ? sessions : sessions.slice(0, initial);
  return (
    <div className={cx('flex flex-col gap-3', className)}>
      {shown.map((s) => (
        <Session key={s.key} session={s} nowMs={nowMs} />
      ))}
      {hidden > 0 ? (
        <Button
          title={expanded ? 'Show less' : `Show ${hidden} more ${hidden === 1 ? 'class' : 'classes'}`}
          variant="tertiary"
          size="sm"
          icon={expanded ? IoChevronUp : IoChevronDown}
          className="self-center"
          onClick={() => setExpanded((v) => !v)}
        />
      ) : null}
    </div>
  );
}

function Session({ session: s, nowMs }: { session: RollCallSession; nowMs: number }) {
  const phase = sessionPhase(s, nowMs);
  const present = presentCount(s);
  const total = s.occurrences.length;
  const onTime = Date.parse(s.on_time_until);
  const deadline = Date.parse(s.deadline);
  const opens = Date.parse(s.opens_at);
  const timing =
    phase === 'open' ? `on time for ${fmtCountdown(onTime - nowMs)}`
    : phase === 'late' ? `late until ${fmtCountdown(deadline - nowMs)}`
    : phase === 'upcoming' ? `opens ${nowMs > opens - 3_600_000 ? `in ${fmtCountdown(opens - nowMs)}` : `at ${fmtTime(s.opens_at)}`}`
    : 'window closed';

  return (
    <div className="bg-surface rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Txt variant="headline" lines={1}>
            {s.course_code}
            <span className="text-text-secondary font-normal"> · {fmtTime(s.starts_at)}</span>
          </Txt>
          <Txt variant="footnote" tone="secondary" lines={1} tabular>
            {s.location_text ? `${s.location_text} · ` : ''}
            {timing}
          </Txt>
        </div>
        <Badge label={`${present} of ${total} present`} tone={present === total ? 'success' : phase === 'closed' ? 'danger' : 'neutral'} className="shrink-0" />
      </div>
      <div className="flex gap-4 mt-3 overflow-x-auto scrollbar-none">
        {s.occurrences.map((o) => (
          <Person key={o.id} occurrence={o} nowMs={nowMs} />
        ))}
      </div>
    </div>
  );
}

function Person({ occurrence: o, nowMs }: { occurrence: Occurrence; nowMs: number }) {
  const phase = phaseOf(o, nowMs);
  const dot =
    phase === 'posted' ? { cls: 'bg-success', icon: IoCheckmark, label: 'present' }
    : phase === 'posted_late' ? { cls: 'bg-warning', icon: IoCheckmark, label: 'late' }
    : phase === 'missed' || phase === 'closed' ? { cls: 'bg-danger', icon: IoClose, label: 'missing' }
    : phase === 'excused' ? { cls: 'bg-info', icon: IoCheckmark, label: 'excused' }
    : null;
  const dim = !dot;
  return (
    <ProfileLink username={o.username} label={o.display_name} className="flex flex-col items-center gap-1 shrink-0 w-14">
      <span className={cx('relative', dim && 'opacity-45')}>
        <Avatar name={o.display_name} src={o.avatar_url} size={44} />
        {dot ? (
          <span className="absolute -right-0.5 -bottom-0.5 w-5 h-5 rounded-full bg-bg flex items-center justify-center">
            <span className={cx('w-4 h-4 rounded-full text-text-inverse flex items-center justify-center', dot.cls)}>
              <Icon icon={dot.icon} size={10} />
            </span>
          </span>
        ) : null}
      </span>
      <Txt variant="caption" tone={dim ? 'tertiary' : 'secondary'} lines={1} className="w-full text-center">
        {dot ? o.display_name.split(' ')[0] : 'waiting'}
      </Txt>
    </ProfileLink>
  );
}
