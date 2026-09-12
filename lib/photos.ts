import { useEffect, useState } from 'react';
import { PHOTO_BUCKET } from './config';
import { supabase } from './supabase';

// Signed URLs are valid for an hour; cache them so polling never re-signs.
const cache = new Map<string, { url: string; exp: number }>();

export async function signedUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const hit = cache.get(path);
  if (hit && hit.exp > Date.now()) return hit.url;
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path, 3600);
  if (error || !data) return null;
  cache.set(path, { url: data.signedUrl, exp: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
}

export function usePhotoUrl(path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() => (path ? cache.get(path)?.url ?? null : null));
  useEffect(() => {
    let alive = true;
    if (!path) {
      setUrl(null);
      return;
    }
    signedUrl(path).then((u) => {
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [path]);
  return url;
}
