// The capture screen: full-bleed camera in the dark capture palette, shutter like the system
// camera, course and countdown at the top, and the fallbacks when the camera is not available.
import { IoClose, IoImagesOutline } from 'react-icons/io5';
import type { PostStage } from '@/lib/usePost';
import { fmtCountdown } from '@/lib/time';
import { Button, cx, Icon, IconButton, Spinner, Txt } from '@/ui';

export function CameraStage({
  videoRef,
  stage,
  facing,
  frontUrl,
  courseCode,
  remainingMs,
  late,
  onStart,
  onShoot,
  onClose,
  onPickFile,
  error,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  stage: PostStage;
  facing: 'user' | 'environment';
  frontUrl: string | null;
  courseCode: string;
  remainingMs: number;
  late: boolean;
  onStart: () => void;
  onShoot: () => void;
  onClose: () => void;
  onPickFile: (f: File) => void;
  error: string | null;
}) {
  const live = stage === 'front' || stage === 'back';
  const frozen = stage === 'flipping' || stage === 'back';
  return (
    <div className="capture relative flex flex-col h-full">
      {/* camera */}
      <div className="absolute inset-0">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={cx('absolute inset-0 w-full h-full object-cover', facing === 'user' && '-scale-x-100', live ? 'opacity-100' : 'opacity-0')}
        />
        {frozen && frontUrl ? <img src={frontUrl} alt="" className={cx('absolute inset-0 w-full h-full object-cover', stage === 'back' && 'opacity-0')} /> : null}
        {stage === 'back' ? (
          <div className="absolute top-[calc(env(safe-area-inset-top)+72px)] left-3 w-[30%] rounded-lg overflow-hidden ring-2 ring-capture-text" style={{ aspectRatio: '3 / 4' }}>
            {frontUrl ? <img src={frontUrl} alt="" className="w-full h-full object-cover" /> : null}
          </div>
        ) : null}
      </div>

      {/* top bar */}
      <div className="safe-top relative z-10 flex items-center gap-3 px-4 pt-2">
        <IconButton icon={IoClose} label="Close" tone="scrim" onClick={onClose} />
        <div className="flex-1 min-w-0">
          <Txt variant="headline" tone="capture" lines={1} style={{ textShadow: '0 1px 8px rgba(0,0,0,.6)' }}>
            {courseCode}
          </Txt>
        </div>
        <span className={cx('rounded-full px-3 h-8 inline-flex items-center bg-scrim text-subhead tabular font-semibold', late ? 'text-warning' : 'text-capture-text')}>
          {late ? 'late · ' : ''}
          {fmtCountdown(remainingMs)}
        </span>
      </div>

      {/* centre states */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center">
        {stage === 'idle' || stage === 'starting' ? <Spinner size={28} className="text-capture-text" /> : null}
        {stage === 'flipping' ? (
          <Txt variant="subhead" tone="capture" style={{ textShadow: '0 1px 8px rgba(0,0,0,.6)' }}>
            Now the room…
          </Txt>
        ) : null}
        {stage === 'unavailable' || stage === 'error' ? (
          <div className="flex flex-col items-center gap-3 max-w-[320px]">
            <Txt variant="headline" tone="capture">
              {stage === 'error' ? 'Something went wrong' : error ? 'Camera unavailable' : 'No camera here'}
            </Txt>
            <Txt variant="subhead" tone="captureSecondary">
              {error ?? 'Use a photo from your library instead.'}
            </Txt>
            <label className="w-full">
              <input type="file" accept="image/*" capture="user" className="sr-only" onChange={(e) => e.target.files?.[0] && onPickFile(e.target.files[0])} />
              <span className="pressable inline-flex items-center justify-center gap-2 w-full h-[var(--button-lg)] rounded-md bg-capture-text text-capture-bg text-headline">
                <Icon icon={IoImagesOutline} size={18} /> Choose a photo
              </span>
            </label>
            <Button title="Try again" variant="tertiary" onClick={onStart} className="text-capture-text-secondary" />
          </div>
        ) : null}
      </div>

      {/* shutter */}
      <div className="safe-bottom relative z-10 flex items-center justify-center pb-6 pt-3 h-[140px]">
        {stage === 'front' ? (
          <button type="button" onClick={onShoot} aria-label="Take photo" className="pressable w-[78px] h-[78px] rounded-full border-[4px] border-capture-text flex items-center justify-center">
            <span className="w-[62px] h-[62px] rounded-full bg-capture-text" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
