// The feed body: day separators, one component per event type, hairlines, empty and loading states.
import { IoPersonAddOutline, IoTimeOutline } from 'react-icons/io5';
import { useNavigate } from 'react-router';
import { commentsFor, groupByDay, photoExpired, reactionsFor } from '@/lib/feed';
import { groupPosts } from '@/lib/presence';
import type { Comment, FeedEvent, Occurrence, Reaction } from '@/lib/types';
import { fmtTime } from '@/lib/time';
import { Button, EmptyState, Skeleton, Strong, Txt } from '@/ui';
import { ExcusedLine, FriendsLine, MissCard } from './MissCard';
import { PostCard } from './PostCard';
import { TogetherDeck } from './TogetherDeck';

export function FeedList({
  events,
  reactions,
  comments,
  meId,
  nowMs,
  loading,
  friendsCount,
  unexplainedMissIds,
  nextUp,
}: {
  events: FeedEvent[];
  reactions: Reaction[];
  comments: Comment[];
  meId: string | null;
  nowMs: number;
  loading: boolean;
  friendsCount: number;
  unexplainedMissIds: Set<string>;
  /** A friend's next upcoming class, for the quiet-day empty state. */
  nextUp: Occurrence | null;
}) {
  const navigate = useNavigate();
  if (loading && events.length === 0) return <FeedSkeleton />;
  if (events.length === 0) {
    if (friendsCount === 0) {
      return (
        <EmptyState
          icon={IoPersonAddOutline}
          title="Present is better with friends"
          message="Add the people whose 9:30 you want to see."
          action={
            <div className="flex flex-col gap-2">
              <Button title="Add friends" size="lg" onClick={() => navigate('/friends')} />
              <Button title="Share my link" variant="tertiary" onClick={() => navigate('/friends/share')} />
            </div>
          }
        />
      );
    }
    return (
      <EmptyState
        icon={IoTimeOutline}
        title="Nothing yet today"
        message={nextUp ? undefined : 'Posts land here as your friends walk into class.'}
        action={
          nextUp ? (
            <Txt variant="subhead" tone="secondary" align="center">
              Next up: <Strong>{nextUp.display_name}</Strong> has {nextUp.course_code} at {fmtTime(nextUp.starts_at)}
            </Txt>
          ) : undefined
        }
      />
    );
  }
  const sections = groupByDay(events, nowMs);
  return (
    <div className="pb-4">
      {sections.map((s, si) => (
        <section key={s.key}>
          <Txt variant="label" tone="tertiary" className="px-4 pt-4 pb-1">
            {s.label}
          </Txt>
          {groupPosts(s.events).map((row, i) =>
            row.kind === 'group' ? (
              <div key={row.group.key}>
                {i > 0 ? <div className="hairline mx-4" /> : null}
                <TogetherDeck group={row.group} reactions={reactions} comments={comments} meId={meId} nowMs={nowMs} />
              </div>
            ) : (
              <div key={row.event.id}>
                {i > 0 ? <div className="hairline mx-4" /> : null}
                <FeedItem event={row.event} reactions={reactionsFor(reactions, row.event.id)} comments={commentsFor(comments, row.event.id)} meId={meId} nowMs={nowMs} unexplained={!!row.event.ref_id && unexplainedMissIds.has(row.event.ref_id)} eager={si === 0 && i === 0} />
              </div>
            ),
          )}
        </section>
      ))}
    </div>
  );
}

function FeedItem({ event, reactions, comments, meId, nowMs, unexplained, eager }: { event: FeedEvent; reactions: Reaction[]; comments: Comment[]; meId: string | null; nowMs: number; unexplained: boolean; eager: boolean }) {
  switch (event.type) {
    case 'post':
      return <PostCard event={event} reactions={reactions} comments={comments} meId={meId} nowMs={nowMs} expired={photoExpired(event, nowMs, meId)} eager={eager} />;
    case 'miss':
      return <MissCard event={event} reactions={reactions} comments={comments} meId={meId} nowMs={nowMs} unexplained={event.actor_id === meId && unexplained} />;
    case 'excused':
      return <ExcusedLine event={event} nowMs={nowMs} />;
    case 'friends':
      return <FriendsLine event={event} nowMs={nowMs} />;
    default:
      return null;
  }
}

export function FeedSkeleton() {
  return (
    <div className="px-4 pt-4 flex flex-col gap-6" aria-busy>
      {[0, 1].map((i) => (
        <div key={i}>
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="flex-1 flex flex-col gap-1.5">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
          <Skeleton className="mt-3 rounded-xl" style={{ aspectRatio: '3 / 4' }} />
        </div>
      ))}
    </div>
  );
}
