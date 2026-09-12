// Signed-URL image with a skeleton while it loads. Paths are storage keys or "mock:" seeds.
// Known URLs resolve synchronously so a revisit paints from the browser cache on the first frame.
import { useEffect, useRef, useState } from 'react';
import { peekSignedUrl, signedUrl } from '@/lib/api/post';
import { cx, Skeleton } from '@/ui';

export function usePhotoUrl(path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() => peekSignedUrl(path));
  useEffect(() => {
    let alive = true;
    const known = peekSignedUrl(path);
    setUrl(known);
    if (!path || known) return;
    void signedUrl(path).then((u) => {
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [path]);
  return url;
}

/**
 * The <img> every photo uses: CORS mode so the service worker can cache the bytes, lazy and async
 * so a long feed does not fight over bandwidth, and "loaded" also detected for images that come
 * straight from the cache (no load event fires after the fact).
 */
export function CachedImg({ url, alt = '', className, eager = false, onLoaded }: { url: string; alt?: string; className?: string; eager?: boolean; onLoaded: () => void }) {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && el.complete && el.naturalWidth > 0) onLoaded();
  }, [url, onLoaded]);
  return (
    <img
      ref={ref}
      src={url}
      alt={alt}
      crossOrigin="anonymous"
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={eager ? 'high' : 'auto'}
      draggable={false}
      onLoad={onLoaded}
      className={className}
    />
  );
}

export function Photo({ path, alt = '', className, ratio = '3 / 4', rounded = 'rounded-xl' }: { path: string | null | undefined; alt?: string; className?: string; ratio?: string; rounded?: string }) {
  const url = usePhotoUrl(path);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => setLoaded(false), [url]);
  return (
    <div className={cx('relative overflow-hidden bg-surface-raised', rounded, className)} style={{ aspectRatio: ratio }}>
      {!loaded ? <Skeleton className="absolute inset-0 rounded-none" /> : null}
      {url ? (
        <CachedImg
          url={url}
          alt={alt}
          onLoaded={() => setLoaded(true)}
          className={cx('absolute inset-0 w-full h-full object-cover transition-opacity duration-[var(--duration-base)]', loaded ? 'opacity-100' : 'opacity-0')}
        />
      ) : null}
    </div>
  );
}
