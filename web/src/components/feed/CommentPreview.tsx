import { useNavigate } from 'react-router';
import type { Comment } from '@/lib/types';
import { cx, Strong, Txt } from '@/ui';

/** The last two comments and a link to the rest. Tapping anywhere opens the thread. */
export function CommentPreview({ eventId, comments, className, replyLabel = 'Add a comment' }: { eventId: string; comments: Comment[]; className?: string; replyLabel?: string }) {
  const navigate = useNavigate();
  const last = comments.slice(-2);
  const more = comments.length - last.length;
  return (
    <button type="button" onClick={() => navigate(`/comments/${eventId}`)} className={cx('block w-full text-left', className)}>
      {more > 0 ? (
        <Txt variant="subhead" tone="tertiary" className="mb-0.5">
          View all {comments.length} comments
        </Txt>
      ) : null}
      {last.map((c) => (
        <Txt key={c.id} variant="subhead" lines={2} className="selectable">
          <Strong>{c.username}</Strong> {c.text}
        </Txt>
      ))}
      {comments.length === 0 ? (
        <Txt variant="subhead" tone="tertiary">
          {replyLabel}
        </Txt>
      ) : null}
    </button>
  );
}
