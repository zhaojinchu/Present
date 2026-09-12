import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { PHOTO_BUCKET, UI_PREVIEW } from '../config';
import { previewSubmitCheckin } from '../preview';
import { supabase } from '../supabase';

/** Resize + recompress so uploads are ~150 KB instead of 2–4 MB. */
export async function prepareUpload(uri: string): Promise<string> {
  const out = await manipulateAsync(uri, [{ resize: { width: 1080 } }], { compress: 0.6, format: SaveFormat.JPEG });
  return out.uri;
}

// fetch(file://).arrayBuffer() is what the Supabase Expo docs use; the .blob() route can upload
// 0-byte files in React Native. Fall back to base64 through the file system if it comes back empty.
async function readBytes(uri: string): Promise<ArrayBuffer> {
  try {
    const res = await fetch(uri);
    const buf = await res.arrayBuffer();
    if (buf.byteLength > 0) return buf;
  } catch {
    // fall through
  }
  const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  return decode(b64);
}

export function photoPath(userId: string, occurrenceId: string, side: 'front' | 'back' = 'front'): string {
  return `${userId}/${occurrenceId}${side === 'back' ? '-back' : ''}.jpg`;
}

export async function uploadPhoto(localUri: string, path: string): Promise<void> {
  const bytes = await readBytes(await prepareUpload(localUri));
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
}

export interface CheckinArgs {
  occurrenceId: string;
  userId: string;
  frontUri: string;
  backUri?: string | null;
  inGeofence: boolean;
}

/**
 * Upload the photo(s), then insert the checkins row. The DB trigger validates the window,
 * flips the occurrence to checked_in and writes the feed event; its error text is user-facing.
 */
export async function submitCheckin(args: CheckinArgs): Promise<void> {
  if (UI_PREVIEW) {
    previewSubmitCheckin(args);
    return;
  }
  const front = photoPath(args.userId, args.occurrenceId);
  const back = args.backUri ? photoPath(args.userId, args.occurrenceId, 'back') : null;
  await uploadPhoto(args.frontUri, front);
  if (args.backUri && back) await uploadPhoto(args.backUri, back);
  const { error } = await supabase.from('checkins').insert({
    occurrence_id: args.occurrenceId,
    user_id: args.userId,
    photo_path: front,
    photo_back_path: back,
    in_geofence: args.inGeofence,
  });
  if (error) throw error;
}
