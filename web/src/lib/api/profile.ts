// Profile photo: resized in the browser, stored in the public avatars bucket, URL saved on the profile.
import { env } from '../config';
import { supabase } from '../supabase';
import { updateProfile } from './social';

const SIZE = 256;

async function squareJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  const side = Math.min(bitmap.width, bitmap.height);
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read that image'))), 'image/jpeg', 0.85));
}

/** Uploads the photo and saves its URL on the profile. Returns the new URL. */
export async function setAvatar(file: File, userId: string): Promise<string> {
  const blob = await squareJpeg(file);
  if (env.mockState) {
    await new Promise((r) => setTimeout(r, 300));
    return URL.createObjectURL(blob);
  }
  const path = `${userId}/avatar.jpg`;
  const { error } = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', upsert: true, cacheControl: '3600' });
  if (error) throw error;
  const url = `${supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
  await updateProfile({ avatar_url: url });
  return url;
}
