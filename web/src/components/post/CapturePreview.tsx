// After the shots: the front photo full, the room as an inset, a caption, retake or post.
import { IoClose } from 'react-icons/io5';
import { CAPTION_MAX } from '@/lib/config';
import { Button, cx, IconButton, Spinner, Txt } from '@/ui';

export function CapturePreview({
  frontUrl,
  backUrl,
  retakes,
  caption,
  onCaption,
  onSwap,
  onRetake,
  onPost,
  onClose,
  uploading,
  error,
}: {
  frontUrl: string;
  backUrl: string | null;
  retakes: number;
  caption: string;
  onCaption: (v: string) => void;
  onSwap: () => void;
  onRetake: () => void;
  onPost: () => void;
  onClose: () => void;
  uploading: boolean;
  error: string | null;
}) {
  return (
    <div className="capture relative flex flex-col h-full">
      <div className="absolute inset-0">
        <img src={frontUrl} alt="" className={cx('absolute inset-0 w-full h-full object-cover transition-opacity', uploading ? 'opacity-60' : 'opacity-100')} />
        {backUrl ? (
          <button type="button" aria-label="Swap photos" onClick={onSwap} className="absolute top-[calc(env(safe-area-inset-top)+72px)] left-3 w-[30%] rounded-lg overflow-hidden ring-2 ring-capture-text pressable" style={{ aspectRatio: '3 / 4' }}>
            <img src={backUrl} alt="" className="w-full h-full object-cover" />
          </button>
        ) : null}
      </div>
      <div className="safe-top relative z-10 flex items-center px-4 pt-2">
        <IconButton icon={IoClose} label="Close" tone="scrim" onClick={onClose} disabled={uploading} />
      </div>
      <div className="flex-1" />
      <div className="safe-bottom relative z-10 px-4 pb-4 pt-6 bg-gradient-to-t from-[rgba(0,0,0,.7)] to-transparent">
        {retakes > 0 ? (
          <Txt variant="footnote" tone="captureSecondary" className="mb-2">
            {retakes === 1 ? '1 retake' : `${retakes} retakes`} · your friends will see that
          </Txt>
        ) : null}
        <input
          value={caption}
          onChange={(e) => onCaption(e.target.value.slice(0, CAPTION_MAX))}
          placeholder="Add a caption"
          maxLength={CAPTION_MAX}
          disabled={uploading}
          className="w-full h-[var(--input)] px-1 bg-transparent text-capture-text text-headline text-center placeholder:text-capture-text-secondary placeholder:font-normal outline-none"
          style={{ textShadow: '0 1px 8px rgba(0,0,0,.7)' }}
        />
        {error ? (
          <Txt variant="footnote" tone="danger" className="mt-2">
            {error}
          </Txt>
        ) : null}
        <div className="flex gap-2 mt-3">
          <Button title="Retake" variant="secondary" size="lg" className="flex-1 !bg-[rgba(255,255,255,0.14)] !text-capture-text" onClick={onRetake} disabled={uploading} block={false} />
          <button type="button" onClick={onPost} disabled={uploading} className="pressable flex-1 h-[var(--button-lg)] rounded-md bg-capture-text text-capture-bg text-headline inline-flex items-center justify-center gap-2 disabled:opacity-70">
            {uploading ? <Spinner size={18} /> : null}
            {uploading ? 'Posting' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  );
}
