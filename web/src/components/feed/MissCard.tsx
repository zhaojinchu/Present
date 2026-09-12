// "Sam missed 15-122": avatar with a red dot, the streak that died, the explanation as the first
// comment, reactions. The misser sees "Explain yourself" until they do.
import { IoClose, IoMedkitOutline } from 'react-icons/io5';
import { useNavigate } from 'react-router';
import { fmtTime, relative } from '@/lib/time';
import type { Comment, FeedEvent, Reaction } from '@/lib/types';
import { Avatar, Badge, Button, Icon, Stat, Strong, Txt } from '@/ui';
import { CommentPreview } from './CommentPreview';
import { ReactionBar } from './ReactionBar';

export function MissCard({
  event,
  reactions,
  comments,
  meId,
  nowMs,
  unexplained,
}: {
  event: FeedEvent;
  reactions: Reaction[];
  comments: Comment[];
  meId: string | null;
  nowMs: number;
  /** True when this is my miss and I have not explained it yet. */
  unexplained: boolean;
}) {
  const p = event.payload;
  const navigate = useNavigate();
  const name = p.display_name ?? 'Someone';
  const before = p.streak_before ?? 0;
  return (
    <article className="py-3 px-4">
      <header className="flex items-start gap-3">
        <span className="relative shrink-0">
          <Avatar name={name} src={p.avatar_url} size={40} />
          <span className="absolute -right-0.5 -bottom-0.5 w-5 h-5 rounded-full bg-bg flex items-center justify-center">
            <span className="w-4 h-4 rounded-full bg-danger text-text-inverse flex items-center justify-center">
              <Icon icon={IoClose} size={10} />
            </span>
          </span>
        </span>
        <div className="flex-1 min-w-0">
          <Txt variant="body" lines={2}>
            <Strong>{name}</Strong> <span className="text-danger font-semibold">missed</span> {p.course_code ?? 'class'}
            {p.starts_at ? <span className="text-text-secondary"> at {fmtTime(p.starts_at)}</span> : null}
          </Txt>
        </div>
        <Txt variant="footnote" tone="tertiary" className="shrink-0 pt-0.5">
          {relative(event.created_at, nowMs)}
        </Txt>
      </header>
      {before > 0 ? (
        <div className="flex items-end gap-4 mt-3">
          <Stat size="sm" value={before} label="Streak was" tone="tertiary" />
          <Stat size="sm" value={0} label="Now" tone="danger" />
        </div>
      ) : null}
      {unexplained ? (
        <Button title="Explain yourself" variant="secondary" size="sm" className="mt-3" onClick={() => event.ref_id && navigate(`/explain/${event.ref_id}`)} />
      ) : null}
      <ReactionBar eventId={event.id} reactions={reactions} meId={meId} className="mt-3" />
      <CommentPreview eventId={event.id} comments={comments} className="mt-2" replyLabel="Reply" />
    </article>
  );
}

export function ExcusedLine({ event, nowMs }: { event: FeedEvent; nowMs: number }) {
  const p = event.payload;
  return (
    <div className="py-3 px-4 flex items-center gap-3">
      <Avatar name={p.display_name ?? '?'} src={p.avatar_url} size={40} />
      <div className="flex-1 min-w-0">
        <Txt variant="body" lines={1}>
          <Strong>{p.display_name}</Strong> is excused from {p.course_code ?? 'class'}
        </Txt>
        <div className="flex items-center gap-2 mt-1">
          <Badge label="Excused" tone="info" icon={IoMedkitOutline} />
          <Txt variant="footnote" tone="secondary">
            Streak stays.
          </Txt>
        </div>
      </div>
      <Txt variant="footnote" tone="tertiary">
        {relative(event.created_at, nowMs)}
      </Txt>
    </div>
  );
}

export function FriendsLine({ event, nowMs }: { event: FeedEvent; nowMs: number }) {
  const p = event.payload;
  return (
    <div className="py-3 px-4">
      <Txt variant="footnote" tone="tertiary" align="center">
        <Strong className="text-text-secondary">{p.display_name}</Strong> and <Strong className="text-text-secondary">{p.friend_name}</Strong> are now friends · {relative(event.created_at, nowMs)}
      </Txt>
    </div>
  );
}
