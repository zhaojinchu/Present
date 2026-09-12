// fetch-ics: fetches a public calendar link server-side (browsers cannot, no CORS) and returns
// its text. Signed-in users only. Guards: https only, no private hosts, at most 3 redirects each
// re-checked, 10 s timeout, 2 MB cap, must look like a calendar.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const MAX_BYTES = 2 * 1024 * 1024;
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

function isPrivateHost(h: string): boolean {
  return (
    /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[?::1|\[?fc|\[?fd)/i.test(h) ||
    h.endsWith('.internal') ||
    h.endsWith('.local') ||
    h === 'metadata.google.internal'
  );
}

function checkUrl(u: URL): string | null {
  if (u.protocol !== 'https:') return 'Only https links are supported';
  if (isPrivateHost(u.hostname)) return 'That host is not allowed';
  return null;
}

async function fetchFollowing(u: URL, signal: AbortSignal, hops = 3): Promise<Response> {
  let current = u;
  for (let i = 0; i <= hops; i++) {
    const res = await fetch(current.toString(), { redirect: 'manual', signal, headers: { accept: 'text/calendar, text/plain;q=0.8, */*;q=0.5', 'user-agent': 'Present/1.0 (+https://present.expo.app)' } });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) return res;
      const nextUrl = new URL(loc, current);
      const bad = checkUrl(nextUrl);
      if (bad) throw new Error(bad);
      current = nextUrl;
      continue;
    }
    return res;
  }
  throw new Error('Too many redirects');
}

async function readCapped(body: ReadableStream<Uint8Array>, cap: number): Promise<Uint8Array> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > cap) {
      await reader.cancel();
      throw new Error('too large');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'POST only' });

  const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data } = await supa.auth.getUser();
  if (!data.user) return json(401, { error: 'Sign in first' });

  let url: URL;
  try {
    const body = (await req.json().catch(() => ({}))) as { url?: string };
    url = new URL(String(body.url ?? '').trim().replace(/^webcal:\/\//i, 'https://'));
  } catch {
    return json(400, { error: 'That is not a valid link' });
  }
  const bad = checkUrl(url);
  if (bad) return json(400, { error: bad });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetchFollowing(url, ctrl.signal);
    if (!res.ok) return json(502, { error: `The calendar server replied ${res.status}` });
    const ct = (res.headers.get('content-type') ?? '').toLowerCase();
    if (ct && !/text\/calendar|text\/plain|application\/octet-stream|application\/ics|application\/x-ics/.test(ct)) {
      return json(415, { error: 'That link is not a calendar feed' });
    }
    const bytes = await readCapped(res.body ?? new ReadableStream(), MAX_BYTES);
    const text = new TextDecoder().decode(bytes);
    if (!/^﻿?\s*BEGIN:VCALENDAR/i.test(text.slice(0, 64))) return json(415, { error: 'That link is not a calendar feed' });
    return json(200, { text, bytes: bytes.byteLength });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'too large') return json(413, { error: 'That calendar is too large (2 MB max)' });
    if (msg.includes('abort')) return json(504, { error: 'The calendar server took too long' });
    return json(502, { error: msg || 'Could not fetch that link' });
  } finally {
    clearTimeout(timer);
  }
});
