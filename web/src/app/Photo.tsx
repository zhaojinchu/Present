// Signed-URL image with a skeleton while it loads. Paths are storage keys or "mock:" seeds.
import { useEffect, useState } from 'react';
import { signedUrl } from '@/lib/api/post';
import { cx, Skeleton } from '@/ui';

export function usePhotoUrl(path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setUrl(null);
    if (!path) return;
    void signedUrl(path).then((u) => {
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [path]);
  return url;
}

export function Photo({ path, alt = '', className, ratio = '3 / 4', rounded = 'rounded-xl' }: { path: string | null | undefined; alt?: string; className?: string; ratio?: string; rounded?: string }) {
  const url = usePhotoUrl(path);
  const [loaded, setLoaded] = useState(false);
  return (
    <div className={cx('relative overflow-hidden bg-surface-raised', rounded, className)} style={{ aspectRatio: ratio }}>
      {!loaded ? <Skeleton className="absolute inset-0 rounded-none" /> : null}
      {url ? (
        <img
          src={url}
          alt={alt}
          onLoad={() => setLoaded(true)}
          draggable={false}
          className={cx('absolute inset-0 w-full h-full object-cover transition-opacity duration-[var(--duration-base)]', loaded ? 'opacity-100' : 'opacity-0')}
        />
      ) : null}
    </div>
  );
}
