// Posts from the same class session as one card stack. The top card swipes left or right (Motion
// drag) to reveal the next person; the two behind peek out beneath it. Reactions and comments
// belong to whichever post is on top.
import { AnimatePresence, motion, type PanInfo } from 'motion/react';
import { useRef, useState } from 'react';
import { IoLocationOutline } from 'react-icons/io5';
import { useNavigate } from 'react-router';
import { haptic } from '@/lib/haptics';
import { commentsFor, photoExpired, reactionsFor } from '@/lib/feed';
import { listNames, type PostGroup } from '@/lib/presence';
import { fmtTime, relative } from '@/lib/time';
import type { Comment, FeedEvent, Reaction } from '@/lib/types';
import { ProfileAvatarStack } from '@/components/ProfileAvatarStack';
import { Avatar, Badge, cx, Strong, StreakChip, Txt } from '@/ui';
import { CommentPreview } from './CommentPreview';
import { PostMedia } from './PostMedia';
import { ReactionBar } from './ReactionBar';

// A slow, deliberate swipe must count as much as a flick: a short distance (or a sixth of the
// card, whichever is smaller) or a modest velocity, as long as the motion was mostly sideways.
const SWIPE_DISTANCE = 40;
const SWIPE_VELOCITY = 240;

export function TogetherDeck({
  group,
  reactions,
  comments,
  meId,
  nowMs,
}: {
  group: PostGroup;
  reactions: Reaction[];
  comments: Comment[];
  meId: string | null;
  nowMs: number;
}) {
  const navigate = useNavigate();
  const deckRef = useRef<HTMLDivElement>(null);
  const posts = group.events;
  const [[index, direction], setPage] = useState<[number, number]>([0, 0]);
  const count = posts.length;
  const active = posts[index] ?? posts[0];
  const names = posts.map((e) => e.payload.display_name ?? 'Someone');

  const paginate = (dir: 1 | -1) => {
    haptic('light');
    setPage(([i]) => [(i + dir + count) % count, dir]);
  };
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (count < 2) return;
    const width = deckRef.current?.getBoundingClientRect().width ?? 320;
    const distance = Math.min(SWIPE_DISTANCE, width / 6);
    const { x, y } = info.offset;
    if (Math.abs(x) < Math.abs(y) * 0.8) return; // mostly vertical: the list was scrolling
    if (x < -distance || info.velocity.x < -SWIPE_VELOCITY) paginate(1);
    else if (x > distance || info.velocity.x > SWIPE_VELOCITY) paginate(-1);
  };
  // Tap the right third for the next person, the left third for the previous (stories convention).
  // Motion only fires onTap when the pointer did not drag, so this never fights the swipe.
  const onTap = (_: unknown, info: { point: { x: number } }) => {
    if (count < 2) return;
    const rect = deckRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    // info.point is in page coordinates.
    const rel = (info.point.x - window.scrollX - rect.left) / rect.width;
    if (rel > 0.66) paginate(1);
    else if (rel < 0.34) paginate(-1);
  };

  return (
    <article className="py-3">
      <header className="flex items-start gap-3 px-4">
        <ProfileAvatarStack people={posts.map((e) => ({ name: e.payload.display_name ?? '?', src: e.payload.avatar_url, username: e.payload.username }))} size={40} max={3} className="shrink-0" />
        <div className="flex-1 min-w-0">
          <Txt variant="body" lines={2}>
            <Strong>{listNames(names)}</Strong> are in {group.course_code}
          </Txt>
          <Txt variant="footnote" tone="tertiary" lines={1}>
            {fmtTime(group.starts_at)}
            {group.location_text ? ` · ${group.location_text}` : ''} · {count} posted
          </Txt>
        </div>
        <Txt variant="footnote" tone="tertiary" className="shrink-0 pt-0.5">
          {relative(posts[0].created_at, nowMs)}
        </Txt>
      </header>

      {/* The deck. Fixed 3:4 box; cards are absolutely stacked inside it. */}
      <div className="px-2 mt-3">
        <div ref={deckRef} className="relative" style={{ aspectRatio: '3 / 4' }} data-swipe-ignore>
          {[2, 1].map((depth) => {
            if (count <= depth) return null;
            const e = posts[(index + depth) % count];
            return (
              <div
                key={`back-${depth}-${e.id}`}
                className="absolute inset-0 rounded-xl bg-surface-raised overflow-hidden"
                style={{ transform: `translateY(${depth * 10}px) scale(${1 - depth * 0.045})`, transformOrigin: 'top center', opacity: depth === 1 ? 0.9 : 0.7 }}
                aria-hidden
              >
                <PostMedia mainPath={e.payload.photo_path} placeholder="" className="pointer-events-none" />
              </div>
            );
          })}
          <AnimatePresence initial={false} custom={direction}>
            <motion.div
              key={active.id}
              className="absolute inset-0 touch-pan-y"
              custom={direction}
              variants={{
                enter: (d: number) => ({ x: d > 0 ? 320 : d < 0 ? -320 : 0, opacity: 0, rotate: d * 6 }),
                center: { x: 0, opacity: 1, rotate: 0, zIndex: 1 },
                exit: (d: number) => ({ x: d > 0 ? -360 : 360, opacity: 0, rotate: d * -8, zIndex: 0 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ x: { type: 'spring', stiffness: 380, damping: 34 }, opacity: { duration: 0.18 } }}
              drag={count > 1 ? 'x' : false}
              dragDirectionLock
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.9}
              dragMomentum={false}
              onDragEnd={onDragEnd}
              onTap={onTap}
            >
              <DeckCard event={active} expired={photoExpired(active, nowMs, meId)} onOpenProfile={() => active.payload.username && navigate(`/u/${active.payload.username}`)} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {count > 1 ? (
        <div className="flex items-center justify-center gap-1.5 mt-3" aria-label={`${index + 1} of ${count}`}>
          {posts.map((e, i) => (
            <button
              key={e.id}
              type="button"
              aria-label={`Show ${e.payload.display_name ?? 'post'}`}
              onClick={() => setPage([i, i > index ? 1 : -1])}
              className={cx('h-1.5 rounded-full transition-all duration-[var(--duration-base)]', i === index ? 'w-4 bg-text' : 'w-1.5 bg-surface-overlay')}
            />
          ))}
        </div>
      ) : null}

      <div className="px-4">
        {active.payload.caption ? (
          <Txt variant="body" className="mt-2 selectable">
            <Strong>{active.payload.display_name}</Strong> {active.payload.caption}
          </Txt>
        ) : null}
        <ReactionBar key={active.id} eventId={active.id} reactions={reactionsFor(reactions, active.id)} meId={meId} className="mt-3" />
        <CommentPreview eventId={active.id} comments={commentsFor(comments, active.id)} className="mt-2" />
      </div>
    </article>
  );
}

/** One person's post inside the deck: the photo with a name plate over the bottom edge. */
function DeckCard({ event, expired, onOpenProfile }: { event: FeedEvent; expired: boolean; onOpenProfile: () => void }) {
  const p = event.payload;
  const name = p.display_name ?? 'Someone';
  return (
    <div className="absolute inset-0 rounded-xl overflow-hidden bg-surface-raised select-none">
      {expired ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <Txt variant="footnote" tone="tertiary">
            This photo has expired.
          </Txt>
        </div>
      ) : (
        <PostMedia mainPath={p.photo_path} insetPath={p.photo_back_path} placeholder={p.course_code ?? ''} rounded="rounded-xl" className="pointer-events-none" late={!!p.late} />
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3 bg-gradient-to-t from-scrim to-transparent">
        <button type="button" onClick={onOpenProfile} className="flex items-center gap-2 min-w-0 text-left">
          <Avatar name={name} src={p.avatar_url} size={28} ring />
          <span className="min-w-0">
            <Txt variant="subhead" tone="inverse" weight={600} lines={1}>
              {name}
            </Txt>
            <Txt variant="caption" tone="inverse" lines={1} className="opacity-80">
              {p.posted_at ? fmtTime(p.posted_at) : ''}
              {p.late ? ' · late' : ''}
            </Txt>
          </span>
        </button>
        <div className="flex items-center gap-1.5 shrink-0">
          {p.location_verified && !p.late ? <Badge label="Nearby" tone="neutral" icon={IoLocationOutline} /> : null}
          {typeof p.streak_after === 'number' ? <StreakChip value={p.streak_after} size="sm" /> : null}
        </div>
      </div>
    </div>
  );
}
