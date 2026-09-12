// Posting: upload the two photos to storage, then create_post() does the rest server-side
// (window rules, late flag, pin and "Nearby", feed event). Photo reads go through signed URLs.
import { env, PHOTO_BUCKET } from '../config';
import { supabase } from '../supabase';
import { mockPhotoUrl } from '@/mock/state';

export function photoPath(userId: string, occurrenceId: string, side: 'front' | 'back' = 'front'): string {
  return `${userId}/${occurrenceId}${side === 'back' ? '-back' : ''}.jpg`;
}

export async function uploadPhoto(blob: Blob, path: string): Promise<void> {
  if (env.mockState) {
    await new Promise((r) => setTimeout(r, 400));
    return;
  }
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
}

export interface CreatePostArgs {
  occurrenceId: string;
  photoPath: string;
  photoBackPath: string | null;
  caption: string | null;
  retakeCount: number;
  position: { lat: number; lng: number; accuracy: number } | null;
}

export interface CreatePostResult {
  post_id: string;
  late: boolean;
  location_verified: boolean;
  streak_after: number;
}

export async function createPost(a: CreatePostArgs): Promise<CreatePostResult> {
  if (env.mockState) {
    await new Promise((r) => setTimeout(r, 500));
    return { post_id: 'mock-post', late: false, location_verified: !!a.position, streak_after: 11 };
  }
  const { data, error } = await supabase.rpc('create_post', {
    p_occurrence_id: a.occurrenceId,
    p_photo_path: a.photoPath,
    p_photo_back_path: a.photoBackPath,
    p_caption: a.caption,
    p_retake_count: a.retakeCount,
    p_lat: a.position?.lat ?? null,
    p_lng: a.position?.lng ?? null,
    p_accuracy: a.position?.accuracy ?? null,
  });
  if (error) throw error;
  return data as CreatePostResult;
}

export interface Memory {
  id: string;
  occurrence_id: string;
  course_code: string;
  starts_at: string;
  photo_path: string | null;
  photo_back_path: string | null;
  caption: string | null;
  late: boolean;
  location_verified: boolean;
  created_at: string;
}

/** My own posts still inside their memory window, newest first. */
export async function getMemories(): Promise<Memory[]> {
  if (env.mockState) {
    const { buildMockState } = await import('@/mock/state');
    const s = buildMockState();
    return s.feed
      .filter((e) => e.type === 'post' && e.actor_id === s.me.id)
      .map((e) => ({
        id: e.ref_id ?? e.id,
        occurrence_id: e.occurrence_id ?? '',
        course_code: e.payload.course_code ?? '',
        starts_at: e.payload.starts_at ?? e.created_at,
        photo_path: e.payload.photo_path ?? null,
        photo_back_path: e.payload.photo_back_path ?? null,
        caption: e.payload.caption ?? null,
        late: !!e.payload.late,
        location_verified: !!e.payload.location_verified,
        created_at: e.created_at,
      }));
  }
  const { data, error } = await supabase.rpc('get_memories');
  if (error) throw error;
  return (data as Memory[]) ?? [];
}

// ---------------------------------------------------------------- signed URLs
//
// A signed URL costs a round trip, and every fresh token is a new CDN cache key, so the same photo
// was re-signed and re-downloaded on every reload. Now: one week TTL, the URL map persisted in
// localStorage so reloads reuse the exact URL (browser cache + CDN hit), and all requests made in
// the same tick are signed in one createSignedUrls call.

const TTL_S = 7 * 24 * 3600;
const STORE_KEY = 'present.photo_urls.v1';
type Entry = { url: string; until: number };

const cache = new Map<string, Entry>(loadStore());
const pending = new Map<string, Promise<string | null>>();
let queue: { path: string; resolve: (u: string | null) => void }[] = [];
let flushTimer: number | null = null;

function loadStore(): [string, Entry][] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') as Record<string, Entry>;
    const now = Date.now();
    return Object.entries(raw).filter(([, e]) => e && typeof e.url === 'string' && e.until > now);
  } catch {
    return [];
  }
}

function saveStore(): void {
  try {
    const now = Date.now();
    const obj: Record<string, Entry> = {};
    for (const [k, e] of cache) if (e.until > now) obj[k] = e;
    localStorage.setItem(STORE_KEY, JSON.stringify(obj));
  } catch {
    // storage full or unavailable: the in-memory map still works
  }
}

/** The URL if it is already known, without a network request (lets images render on first paint). */
export function peekSignedUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('mock:')) return mockPhotoUrl(path);
  const hit = cache.get(path);
  return hit && hit.until > Date.now() ? hit.url : null;
}

export function signedUrl(path: string): Promise<string | null> {
  if (!path) return Promise.resolve(null);
  const known = peekSignedUrl(path);
  if (known) return Promise.resolve(known);
  const inflight = pending.get(path);
  if (inflight) return inflight;
  const p = new Promise<string | null>((resolve) => {
    queue.push({ path, resolve });
    if (flushTimer === null) flushTimer = window.setTimeout(flush, 0);
  });
  pending.set(path, p);
  return p;
}

/** Sign every path the state mentions in one request, ahead of the components that will ask. */
export function prefetchSignedUrls(paths: (string | null | undefined)[]): void {
  const unique = new Set<string>();
  for (const p of paths) if (p && !p.startsWith('mock:') && !peekSignedUrl(p) && !pending.has(p)) unique.add(p);
  for (const p of unique) void signedUrl(p);
}

async function flush(): Promise<void> {
  flushTimer = null;
  const batch = queue;
  queue = [];
  if (batch.length === 0) return;
  const paths = [...new Set(batch.map((b) => b.path))];
  const results = new Map<string, string | null>();
  try {
    const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, TTL_S);
    if (error) throw error;
    for (const r of data ?? []) {
      if (r.path && r.signedUrl && !r.error) {
        results.set(r.path, r.signedUrl);
        cache.set(r.path, { url: r.signedUrl, until: Date.now() + (TTL_S - 3600) * 1000 });
      }
    }
    saveStore();
  } catch (e) {
    console.warn('[present] could not sign photo URLs', e);
  }
  for (const b of batch) {
    pending.delete(b.path);
    b.resolve(results.get(b.path) ?? null);
  }
}
