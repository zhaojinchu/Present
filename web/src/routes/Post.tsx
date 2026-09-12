// /post/:occurrenceId — the full-screen capture flow. No app chrome.
import { useEffect, useMemo } from 'react';
import { IoLockClosedOutline } from 'react-icons/io5';
import { useNavigate, useParams } from 'react-router';
import { CameraStage } from '@/components/post/CameraStage';
import { CapturePreview } from '@/components/post/CapturePreview';
import { PostSuccess } from '@/components/post/PostSuccess';
import { useAppState, useInvalidateState, useMe, useSession, useToday } from '@/lib/appState';
import { useNow } from '@/lib/clock';
import { phaseOf } from '@/lib/phase';
import { fmtTime } from '@/lib/time';
import { usePost } from '@/lib/usePost';
import { Button, EmptyState, Spinner } from '@/ui';

export default function Post() {
  const { occurrenceId } = useParams();
  const navigate = useNavigate();
  const now = useNow();
  const q = useAppState();
  const me = useMe();
  const { userId } = useSession();
  const { mine, theirs } = useToday(now);
  const invalidate = useInvalidateState();
  const target = mine.find((m) => m.occurrence.id === occurrenceId)?.occurrence ?? null;
  const post = usePost(target, userId);
  const friendsThere = useMemo(() => (target ? theirs.filter((t) => t.occurrence.course_code === target.course_code && t.occurrence.status === 'posted').map((t) => t.occurrence) : []), [theirs, target]);

  const close = () => (window.history.length > 1 ? navigate(-1) : navigate('/today'));

  // After success: refresh the state so the feed shows the post, then return to the feed.
  useEffect(() => {
    if (post.stage !== 'success') return;
    void invalidate();
    const t = window.setTimeout(() => navigate('/', { replace: true }), 2400);
    return () => window.clearTimeout(t);
  }, [post.stage, invalidate, navigate]);

  if (q.isPending && !target) {
    return (
      <div className="capture flex-1 flex items-center justify-center h-full">
        <Spinner size={24} />
      </div>
    );
  }
  if (!target) {
    return (
      <div className="flex flex-col h-full bg-bg">
        <EmptyState icon={IoLockClosedOutline} title="That class is not on your schedule today" action={<Button title="Back" variant="secondary" onClick={close} />} className="my-auto" />
      </div>
    );
  }

  const phase = phaseOf(target, now);
  if (post.stage !== 'success' && phase !== 'open' && phase !== 'late') {
    const msg =
      phase === 'upcoming' ? `Posting opens at ${fmtTime(target.opens_at)}.` : phase === 'posted' || phase === 'posted_late' ? 'You already posted for this class.' : 'This window has closed.';
    return (
      <div className="flex flex-col h-full bg-bg">
        <EmptyState icon={IoLockClosedOutline} title={target.course_code} message={msg} action={<Button title="Back" variant="secondary" onClick={close} />} className="my-auto" />
      </div>
    );
  }

  const late = phase === 'late';
  const remaining = (late ? Date.parse(target.deadline) : Date.parse(target.on_time_until)) - now;

  if (post.stage === 'success' && post.front && post.result) {
    return <PostSuccess frontUrl={post.front.url} result={post.result} previousStreak={me?.streak ?? 0} friendsThere={friendsThere} courseCode={target.course_code} />;
  }
  if ((post.stage === 'preview' || post.stage === 'uploading') && post.front) {
    return (
      <CapturePreview
        frontUrl={post.front.url}
        backUrl={post.back?.url ?? null}
        retakes={post.retakes}
        caption={post.caption}
        onCaption={post.setCaption}
        onSwap={post.swapPreview}
        onRetake={post.retake}
        onPost={post.submit}
        onClose={close}
        uploading={post.stage === 'uploading'}
        error={post.error}
      />
    );
  }
  return (
    <CameraStage
      videoRef={post.videoRef}
      stage={post.stage}
      facing={post.facing}
      frontUrl={post.front?.url ?? null}
      courseCode={target.course_code}
      remainingMs={remaining}
      late={late}
      onStart={post.start}
      onShoot={post.shoot}
      onClose={close}
      onPickFile={post.pickFile}
      error={post.error}
    />
  );
}
