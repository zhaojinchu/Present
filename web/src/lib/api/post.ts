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

const cache = new Map<string, { url: string; until: number }>();
const TTL_S = 3600;

export async function signedUrl(path: string): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith('mock:')) return mockPhotoUrl(path);
  const hit = cache.get(path);
  if (hit && hit.until > Date.now()) return hit.url;
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path, TTL_S);
  if (error || !data) return null;
  cache.set(path, { url: data.signedUrl, until: Date.now() + (TTL_S - 600) * 1000 });
  return data.signedUrl;
}
