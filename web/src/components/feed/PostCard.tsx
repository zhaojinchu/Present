// One post in the feed: header row, the photo unit, caption, reactions, comment preview.
// No card, no border; a hairline separates items (drawn by the list).
import { IoLocationOutline } from 'react-icons/io5';
import { useNavigate } from 'react-router';
import { fmtTime, relative } from '@/lib/time';
import type { Comment, FeedEvent, Reaction } from '@/lib/types';
import { Avatar, Badge, Strong, Txt } from '@/ui';
import { CommentPreview } from './CommentPreview';
import { PostMedia } from './PostMedia';
import { ReactionBar } from './ReactionBar';

export function PostCard({
  event,
  reactions,
  comments,
  meId,
  nowMs,
  expired,
  eager = false,
}: {
  event: FeedEvent;
  reactions: Reaction[];
  comments: Comment[];
  meId: string | null;
  nowMs: number;
  expired: boolean;
  /** First card on screen: its photo loads at high priority. */
  eager?: boolean;
}) {
  const p = event.payload;
  const navigate = useNavigate();
  const name = p.display_name ?? 'Someone';
  const minutesLate = p.late && p.posted_at && p.starts_at ? Math.max(1, Math.round((Date.parse(p.posted_at) - Date.parse(p.starts_at) - 10 * 60_000) / 60_000)) : 0;
  const when = p.posted_at ?? event.created_at;

  return (
    <article className="py-3">
      <header className="flex items-start gap-3 px-4">
        <button type="button" onClick={() => p.username && navigate(`/u/${p.username}`)} className="shrink-0" aria-label={name}>
          <Avatar name={name} src={p.avatar_url} size={40} />
        </button>
        <div className="flex-1 min-w-0">
          <Txt variant="body" lines={1}>
            <Strong>{name}</Strong>
            {p.course_code ? <span className="text-text-secondary"> · {p.course_code}</span> : null}
          </Txt>
          <Txt variant="footnote" tone="tertiary" lines={1}>
            {fmtTime(when)}
            {p.location_text ? ` · ${p.location_text}` : ''}
          </Txt>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
          {p.late ? <Badge label={minutesLate > 0 ? `Late ${minutesLate} min` : 'Late'} tone="warning" /> : null}
          {p.location_verified && !p.late ? <Badge label="Nearby" tone="neutral" icon={IoLocationOutline} /> : null}
          <Txt variant="footnote" tone="tertiary">
            {relative(event.created_at, nowMs)}
          </Txt>
        </div>
      </header>

      {expired ? (
        <Txt variant="footnote" tone="tertiary" className="px-4 mt-2">
          This photo has expired.
        </Txt>
      ) : (
        <div className="px-2 mt-3">
          <PostMedia mainPath={p.photo_path} insetPath={p.photo_back_path} placeholder={p.course_code ?? 'No photo'} eager={eager} />
        </div>
      )}

      <div className="px-4">
        {(p.retake_count ?? 0) > 0 ? (
          <Txt variant="footnote" tone="tertiary" className="mt-2">
            {p.retake_count === 1 ? 'took 1 retake' : `took ${p.retake_count} retakes`}
          </Txt>
        ) : null}
        {p.caption ? (
          <Txt variant="body" className="mt-1.5 selectable">
            {p.caption}
          </Txt>
        ) : null}
        <ReactionBar eventId={event.id} reactions={reactions} meId={meId} className="mt-3" />
        <CommentPreview eventId={event.id} comments={comments} className="mt-2" />
      </div>
    </article>
  );
}
