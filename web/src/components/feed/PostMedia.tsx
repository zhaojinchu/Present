// The photo unit: 3:4 main image with the second camera as a picture-in-picture inset in the
// top-left corner, inside the main photo. Tap the inset to swap. Handles missing and loading photos.
import { useEffect, useState } from 'react';
import { CachedImg, usePhotoUrl } from '@/app/Photo';
import { cx, Skeleton, Txt } from '@/ui';

export function PostMedia({
  mainPath,
  insetPath,
  placeholder,
  className,
  rounded = 'rounded-xl',
  eager = false,
  late = false,
}: {
  mainPath: string | null | undefined;
  insetPath?: string | null;
  /** Shown in the frame when there is no photo (seed data without images, expired). */
  placeholder?: string;
  className?: string;
  rounded?: string;
  /** First item on screen: fetch at high priority instead of lazily. */
  eager?: boolean;
  /** Posted after the on-time window: a chip on the photo says so wherever it is shown. */
  late?: boolean;
}) {
  const [swapped, setSwapped] = useState(false);
  useEffect(() => setSwapped(false), [mainPath, insetPath]);
  const big = swapped && insetPath ? insetPath : mainPath;
  const small = swapped && insetPath ? mainPath : insetPath;
  return (
    <div className={cx('relative overflow-hidden bg-surface-raised', rounded, className)} style={{ aspectRatio: '3 / 4' }}>
      <Img path={big} placeholder={placeholder} eager={eager} />
      {small ? (
        <button
          type="button"
          aria-label="Swap photos"
          onClick={() => setSwapped((s) => !s)}
          className="absolute top-2 left-2 w-[30%] overflow-hidden rounded-lg ring-2 ring-bg bg-surface-raised pressable"
          style={{ aspectRatio: '3 / 4' }}
        >
          <Img path={small} />
        </button>
      ) : null}
      {late && mainPath ? (
        <span className="absolute top-2 right-2 inline-flex items-center h-6 px-2 rounded-full bg-warning text-text-inverse text-[11px] font-bold uppercase tracking-wide shadow-sm" aria-label="Posted late">
          Late
        </span>
      ) : null}
    </div>
  );
}

function Img({ path, placeholder, eager = false }: { path: string | null | undefined; placeholder?: string; eager?: boolean }) {
  const url = usePhotoUrl(path);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => setLoaded(false), [url]);
  if (!path) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        {placeholder ? (
          <Txt variant="label" tone="tertiary">
            {placeholder}
          </Txt>
        ) : null}
      </div>
    );
  }
  return (
    <>
      {!loaded ? <Skeleton className="absolute inset-0 rounded-none" /> : null}
      {url ? (
        <CachedImg
          url={url}
          eager={eager}
          onLoaded={() => setLoaded(true)}
          className={cx('absolute inset-0 w-full h-full object-cover transition-opacity duration-[var(--duration-base)]', loaded ? 'opacity-100' : 'opacity-0')}
        />
      ) : null}
    </>
  );
}
