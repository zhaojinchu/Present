// The hero on Today and the compact bar on the feed: one class, one phase, one action.
import { useEffect, useState } from 'react';
import { IoCameraOutline, IoCheckmark, IoMedkitOutline } from 'react-icons/io5';
import { useNavigate } from 'react-router';
import { PostMedia } from '@/components/feed/PostMedia';
import { excuseOccurrence } from '@/lib/api/social';
import { useInvalidateState } from '@/lib/appState';
import { EXPLANATION_MAX } from '@/lib/config';
import { minutesLate, type Phase } from '@/lib/phase';
import { errorMessage } from '@/lib/supabase';
import { fmtCountdown, fmtTime } from '@/lib/time';
import type { Occurrence } from '@/lib/types';
import { AvatarStack, Badge, Button, Card, cx, ErrorText, Icon, Sheet, TextArea, Txt } from '@/ui';
import { CountdownRing } from './CountdownRing';

export function PromptCard({
  occurrence: o,
  phase,
  nowMs,
  friendsPosted,
  unexplainedMissId,
  compact,
}: {
  occurrence: Occurrence;
  phase: Phase;
  nowMs: number;
  /** Friends who already posted from the same course today. */
  friendsPosted: Occurrence[];
  /** My miss id when this occurrence was missed and not yet explained. */
  unexplainedMissId?: string | null;
  compact?: boolean;
}) {
  const navigate = useNavigate();
  const invalidate = useInvalidateState();
  const [busy, setBusy] = useState(false);
  const [excusing, setExcusing] = useState(false);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const opens = Date.parse(o.opens_at);
  const onTime = Date.parse(o.on_time_until);
  const deadline = Date.parse(o.deadline);
  const go = () => navigate(`/post/${o.id}`);
  // "Can't make it" is public: the reason is required and goes in the feed with your name on it.
  const cantMakeIt = () => {
    setErr(null);
    setExcusing(true);
  };
  const announce = async () => {
    setBusy(true);
    setErr(null);
    try {
      await excuseOccurrence(o.id, reason.trim());
      await invalidate();
      setExcusing(false);
      setReason('');
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const excuseSheet = (
    <Sheet open={excusing} onOpenChange={setExcusing} title={`Can't make ${o.course_code}?`}>
      <Txt variant="subhead" tone="secondary">
        Say why. It goes in the feed for everyone to see. Your streak stays.
      </Txt>
      <TextArea value={reason} onChange={(e) => setReason(e.target.value.slice(0, EXPLANATION_MAX))} placeholder="dentist at 2, back for the lab" maxLength={EXPLANATION_MAX} autoFocus className="mt-3" />
      <Txt variant="footnote" tone="tertiary" align="right" tabular className="mt-1">
        {reason.length}/{EXPLANATION_MAX}
      </Txt>
      <Button title="Announce it" size="lg" className="mt-2" loading={busy} disabled={!reason.trim()} onClick={announce} />
      <ErrorText>{err}</ErrorText>
    </Sheet>
  );

  if (compact) {
    if (phase !== 'open' && phase !== 'late') return null;
    return (
      <button type="button" onClick={go} className="pressable w-full flex items-center gap-3 px-4 h-[52px] bg-surface">
        <Icon icon={IoCameraOutline} size={20} className={phase === 'late' ? 'text-warning' : 'text-text'} />
        <Txt variant="headline" className="flex-1 text-left" lines={1}>
          {phase === 'late' ? `Present late from ${o.course_code}` : `Present from ${o.course_code}`}
        </Txt>
        <Txt variant="subhead" tone={phase === 'late' ? 'warning' : 'secondary'} tabular>
          {fmtCountdown((phase === 'late' ? deadline : onTime) - nowMs)}
        </Txt>
      </button>
    );
  }

  const header = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <Txt variant="title" lines={1}>
          {o.course_code}
        </Txt>
        <Txt variant="footnote" tone="secondary" lines={1}>
          {fmtTime(o.starts_at)}
          {o.location_text ? ` · ${o.location_text}` : ''}
          {o.name ? ` · ${o.name}` : ''}
        </Txt>
      </div>
      <PhaseBadge phase={phase} />
    </div>
  );

  const friendsLine =
    friendsPosted.length > 0 ? (
      <div className="flex items-center gap-2 mt-3">
        <AvatarStack people={friendsPosted.map((f) => ({ name: f.display_name, src: f.avatar_url }))} size={24} />
        <Txt variant="footnote" tone="secondary">
          {friendsPosted.length === 1 ? `${firstName(friendsPosted[0].display_name)} posted from ${o.course_code}` : `${friendsPosted.length} friends posted from ${o.course_code}`}
        </Txt>
      </div>
    ) : null;

  const card = (() => {
  switch (phase) {
    case 'open':
      return (
        <Card>
          {header}
          <div className="flex items-center gap-5 mt-4">
            <CountdownRing remainingMs={onTime - nowMs} totalMs={onTime - opens} />
            <div>
              <Txt variant="headline">to stay on time</Txt>
              <Txt variant="footnote" tone="secondary">
                Then it counts as late until {fmtTime(o.deadline)}.
              </Txt>
            </div>
          </div>
          <PulseButton title={`Present from ${o.course_code}`} onClick={go} />
          {friendsLine}
        </Card>
      );
    case 'late':
      return (
        <Card>
          {header}
          <div className="flex items-center gap-5 mt-4">
            <CountdownRing remainingMs={deadline - nowMs} totalMs={deadline - onTime} tone="warning" />
            <div>
              <Txt variant="headline">until it counts as missed</Txt>
              <Txt variant="footnote" tone="secondary">
                A late post shows your friends you made it. It does not count for your streak.
              </Txt>
            </div>
          </div>
          <Button title="Present late" size="lg" className="mt-4" onClick={go} />
          {friendsLine}
        </Card>
      );
    case 'upcoming': {
      const untilOpen = opens - nowMs;
      return (
        <Card>
          {header}
          <div className="mt-4">
            <Txt variant="stat" tabular>
              {untilOpen < 3_600_000 ? fmtCountdown(untilOpen) : fmtTime(o.opens_at)}
            </Txt>
            <Txt variant="footnote" tone="secondary">
              {untilOpen < 3_600_000 ? 'until posting opens' : 'posting opens'}
            </Txt>
          </div>
          <Button title="Can't make it" variant="tertiary" size="sm" className="mt-3 self-start" onClick={cantMakeIt} icon={IoMedkitOutline} />
          {friendsLine}
        </Card>
      );
    }
    case 'closed':
      return (
        <Card>
          {header}
          <Txt variant="subhead" tone="secondary" className="mt-3">
            The window closed. It will be marked missed unless you say why you could not make it.
          </Txt>
          <Button title="I couldn't make it" variant="secondary" size="sm" className="mt-3 self-start" onClick={cantMakeIt} icon={IoMedkitOutline} />
        </Card>
      );
    case 'posted':
    case 'posted_late':
      return (
        <Card className="flex gap-4">
          <div className="w-16 shrink-0">
            <PostMedia mainPath={o.post?.photo_path} insetPath={o.post?.photo_back_path} rounded="rounded-md" placeholder="" late={phase === 'posted_late'} />
          </div>
          <div className="flex-1 min-w-0">
            {header}
            <div className="flex items-center gap-1.5 mt-2">
              <Icon icon={IoCheckmark} size={16} className={phase === 'posted' ? 'text-success' : 'text-warning'} />
              <Txt variant="footnote" tone="secondary">
                Posted {o.posted_at ? fmtTime(o.posted_at) : ''}
                {phase === 'posted' ? ' · on time' : ` · late ${minutesLate(o)} min`}
              </Txt>
            </div>
            {friendsLine}
          </div>
        </Card>
      );
    case 'missed':
      return (
        <Card>
          {header}
          <Txt variant="title" tone="danger" className="mt-3">
            You missed {o.course_code}
          </Txt>
          {unexplainedMissId ? (
            <div className="flex gap-2 mt-3">
              <Button title="Explain yourself" onClick={() => navigate(`/explain/${unexplainedMissId}`)} />
              <Button title="I was sick" variant="secondary" onClick={() => navigate(`/explain/${unexplainedMissId}?excuse=1`)} />
            </div>
          ) : (
            <Txt variant="footnote" tone="secondary" className="mt-1">
              Your friends can see it.
            </Txt>
          )}
        </Card>
      );
    case 'excused':
      return (
        <Card>
          {header}
          <Txt variant="subhead" tone="secondary" className="mt-3">
            Streak stays. Your friends saw why.
          </Txt>
        </Card>
      );
  }
  })();
  return (
    <>
      {card}
      {excuseSheet}
    </>
  );
}

const badge: Record<Phase, { label: string; tone: 'neutral' | 'accent' | 'success' | 'danger' | 'warning' | 'info' }> = {
  upcoming: { label: 'Upcoming', tone: 'neutral' },
  open: { label: 'Open', tone: 'accent' },
  late: { label: 'Late', tone: 'warning' },
  closed: { label: 'Closed', tone: 'danger' },
  posted: { label: 'Posted', tone: 'success' },
  posted_late: { label: 'Posted late', tone: 'warning' },
  missed: { label: 'Missed', tone: 'danger' },
  excused: { label: 'Excused', tone: 'info' },
};

export function PhaseBadge({ phase }: { phase: Phase }) {
  return <Badge label={badge[phase].label} tone={badge[phase].tone} className="shrink-0" />;
}

function firstName(n: string) {
  return n.split(' ')[0] ?? n;
}

/** Primary button with a slow pulse while the window is open. */
function PulseButton({ title, onClick }: { title: string; onClick: () => void }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = window.setInterval(() => setOn((v) => !v), 900);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className={cx('mt-4 transition-transform duration-[900ms] ease-in-out', on ? 'scale-[1.02]' : 'scale-100')}>
      <Button title={title} size="lg" icon={IoCameraOutline} onClick={onClick} />
    </div>
  );
}
