// The posting state machine: camera on a tap, front shot, automatic back shot, retakes, caption,
// upload, create_post. Pure browser APIs (getUserMedia + canvas), so it runs anywhere with HTTPS.
import { useCallback, useEffect, useRef, useState } from 'react';
import { haptic } from './haptics';
import { createPost, photoPath, uploadPhoto, type CreatePostResult } from './api/post';
import { getPosition, type Fix } from './location';
import { errorMessage } from './supabase';
import type { Occurrence } from './types';

export type PostStage =
  | 'idle' // mounted, the camera starts by itself as soon as the class is known
  | 'starting'
  | 'front' // live front camera
  | 'flipping' // front frame frozen, switching to the back camera
  | 'back' // live back camera, auto-shoots shortly
  | 'preview'
  | 'uploading'
  | 'success'
  | 'error'
  | 'unavailable'; // no camera: offer the file picker

export interface Shot {
  blob: Blob;
  url: string;
}

const W = 1080;
const H = 1440; // 3:4

async function captureFrame(video: HTMLVideoElement, mirror: boolean): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const vw = video.videoWidth || W;
  const vh = video.videoHeight || H;
  // object-fit: cover crop to 3:4
  const scale = Math.max(W / vw, H / vh);
  const sw = W / scale;
  const sh = H / scale;
  const sx = (vw - sw) / 2;
  const sy = (vh - sh) / 2;
  if (mirror) {
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, W, H);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read the camera'))), 'image/jpeg', 0.8));
}

async function fileToShot(file: File): Promise<Shot> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const scale = Math.max(W / bitmap.width, H / bitmap.height);
  const sw = W / scale;
  const sh = H / scale;
  ctx.drawImage(bitmap, (bitmap.width - sw) / 2, (bitmap.height - sh) / 2, sw, sh, 0, 0, W, H);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read the photo'))), 'image/jpeg', 0.8));
  return { blob, url: URL.createObjectURL(blob) };
}

function waitForVideo(video: HTMLVideoElement, ms = 3000): Promise<boolean> {
  if (video.readyState >= 2 && video.videoWidth > 0) return Promise.resolve(true);
  return new Promise((resolve) => {
    const t = window.setTimeout(() => resolve(false), ms);
    const on = () => {
      window.clearTimeout(t);
      resolve(true);
    };
    video.addEventListener('loadeddata', on, { once: true });
  });
}

export function usePost(occurrence: Occurrence | null, userId: string | null) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fixRef = useRef<Fix | null>(null);
  const [stage, setStage] = useState<PostStage>('idle');
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [front, setFront] = useState<Shot | null>(null);
  const [back, setBack] = useState<Shot | null>(null);
  const [retakes, setRetakes] = useState(0);
  const [caption, setCaption] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreatePostResult | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const attach = useCallback(async (mode: 'user' | 'environment'): Promise<boolean> => {
    stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode === 'environment' ? { exact: 'environment' } : 'user', width: { ideal: 1080 }, height: { ideal: 1440 } },
        audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current;
      if (!v) return false;
      v.srcObject = stream;
      await v.play().catch(() => {});
      const ok = await waitForVideo(v);
      setFacing(mode);
      return ok;
    } catch (e) {
      const name = (e as { name?: string } | null)?.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') setError('Camera access is off for Present. Allow it in Settings, or choose a photo.');
      return false;
    }
  }, [stopStream]);

  // Start the GPS fix on mount; it is ready by the time the post goes out, or it is skipped.
  useEffect(() => {
    let alive = true;
    void getPosition().then((f) => {
      if (alive) fixRef.current = f;
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(
    () => () => {
      stopStream();
      if (front) URL.revokeObjectURL(front.url);
      if (back) URL.revokeObjectURL(back.url);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const start = useCallback(async () => {
    setError(null);
    setStage('starting');
    if (!navigator.mediaDevices?.getUserMedia) {
      setStage('unavailable');
      return;
    }
    const ok = await attach('user');
    setStage(ok ? 'front' : 'unavailable');
  }, [attach]);

  // No "tap to start": the camera opens on its own once the class is known and the video element
  // is mounted. Runs once; "Try again" calls start() by hand after that.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!occurrence || autoStarted.current || stage !== 'idle') return;
    autoStarted.current = true;
    void start();
  }, [occurrence, stage, start]);

  const shoot = useCallback(async () => {
    const v = videoRef.current;
    if (!v || stage !== 'front') return;
    try {
      haptic('medium');
      const blob = await captureFrame(v, true); // mirrored, matching the preview
      setFront({ blob, url: URL.createObjectURL(blob) });
      setStage('flipping');
      const ok = await attach('environment');
      if (!ok) {
        stopStream();
        setStage('preview');
        return;
      }
      setStage('back');
      await new Promise((r) => setTimeout(r, 900)); // let exposure settle
      const bv = videoRef.current;
      if (bv && streamRef.current) {
        const bblob = await captureFrame(bv, false);
        setBack({ blob: bblob, url: URL.createObjectURL(bblob) });
      }
      stopStream();
      setStage('preview');
    } catch (e) {
      setError(errorMessage(e));
      setStage('error');
    }
  }, [attach, stage, stopStream]);

  const retake = useCallback(async () => {
    setRetakes((n) => n + 1);
    if (front) URL.revokeObjectURL(front.url);
    if (back) URL.revokeObjectURL(back.url);
    setFront(null);
    setBack(null);
    setStage('starting');
    const ok = await attach('user');
    setStage(ok ? 'front' : 'unavailable');
  }, [attach, back, front]);

  const pickFile = useCallback(async (file: File) => {
    try {
      const shot = await fileToShot(file);
      setFront(shot);
      setBack(null);
      setStage('preview');
    } catch (e) {
      setError(errorMessage(e));
      setStage('error');
    }
  }, []);

  const submit = useCallback(async () => {
    if (!occurrence || !userId || !front) return;
    setStage('uploading');
    setError(null);
    try {
      const frontPath = photoPath(userId, occurrence.id, 'front');
      const backPath = back ? photoPath(userId, occurrence.id, 'back') : null;
      await uploadPhoto(front.blob, frontPath);
      if (back && backPath) await uploadPhoto(back.blob, backPath);
      const r = await createPost({
        occurrenceId: occurrence.id,
        photoPath: frontPath,
        photoBackPath: backPath,
        caption: caption.trim() || null,
        retakeCount: retakes,
        position: fixRef.current,
      });
      haptic('success');
      setResult(r);
      setStage('success');
    } catch (e) {
      setError(errorMessage(e));
      setStage('error');
    }
  }, [back, caption, front, occurrence, retakes, userId]);

  const swapPreview = useCallback(() => {
    if (!back || !front) return;
    setFront(back);
    setBack(front);
  }, [back, front]);

  return { videoRef, stage, facing, front, back, retakes, caption, setCaption, error, result, start, shoot, retake, pickFile, submit, swapPreview };
}
