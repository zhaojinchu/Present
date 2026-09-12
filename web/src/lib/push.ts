// Web Push: turning notifications on and off for this browser, and keeping the server's copy of
// the subscription fresh. iOS only allows this from an app on the Home Screen (16.4+), and only
// from a tap, so enablePush() must run inside a click handler.
import { env } from './config';
import { supabase } from './supabase';

export type PushStatus = 'unsupported' | 'install' | 'prompt' | 'denied' | 'on' | 'off';

function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
function standalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Can this browser do push at all, and if not, is installing the fix? */
export function pushSupport(): 'ok' | 'install' | 'unsupported' {
  if (typeof window === 'undefined' || env.mockState) return 'unsupported';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return isIos() && !standalone() ? 'install' : 'unsupported';
  return 'ok';
}

export async function pushStatus(): Promise<PushStatus> {
  const support = pushSupport();
  if (support !== 'ok') return support;
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted') return 'prompt';
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return sub ? 'on' : 'off';
}

export const pushLabel: Record<PushStatus, string> = {
  unsupported: 'Not available in this browser',
  install: 'Add Present to your Home Screen first',
  prompt: 'Off',
  denied: 'Blocked. Allow notifications for Present in iPhone Settings.',
  on: 'On',
  off: 'Off',
};

/** Must be called from a user gesture. */
export async function enablePush(): Promise<PushStatus> {
  const support = pushSupport();
  if (support !== 'ok') return support;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'prompt';
  const { data: key, error } = await supabase.rpc('push_public_key');
  if (error || typeof key !== 'string' || key.length < 60) throw new Error('Notifications are not set up on the server yet.');
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(key) });
  await save(sub);
  // A first notification right away, so the person knows it worked.
  await supabase.rpc('push_test').then(() => undefined, () => undefined);
  return 'on';
}

export async function disablePush(): Promise<PushStatus> {
  const support = pushSupport();
  if (support !== 'ok') return support;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await supabase.rpc('remove_push_subscription', { p_endpoint: sub.endpoint });
    await sub.unsubscribe();
  }
  return 'off';
}

/** After sign-in: a subscription this browser already holds is re-attached to this account. */
export async function syncPushSubscription(): Promise<void> {
  try {
    if (pushSupport() !== 'ok' || Notification.permission !== 'granted') return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await save(sub);
  } catch {
    // never block the app on this
  }
}

async function save(sub: PushSubscription): Promise<void> {
  const j = sub.toJSON();
  const { error } = await supabase.rpc('save_push_subscription', { p_endpoint: sub.endpoint, p_p256dh: j.keys?.p256dh ?? '', p_auth: j.keys?.auth ?? '' });
  if (error) throw error;
}

function toKey(b64url: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (b64url.length % 4)) % 4);
  const raw = atob((b64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
