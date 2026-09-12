/* eslint-disable no-console */
// Exercises the deployed fetch-ics edge function as a seed user. `npm run ics:fetch [url]`
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anon) throw new Error('SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY must be set in .env');
const supabase = createClient(url, anon, { auth: { persistSession: false } });
const { error: authErr } = await supabase.auth.signInWithPassword({ email: 'alex@present.demo', password: 'present-demo-2026' });
if (authErr) throw authErr;

async function tryUrl(target: string) {
  const t0 = Date.now();
  const { data, error } = await supabase.functions.invoke<{ text: string; bytes: number }>('fetch-ics', { body: { url: target } });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const body = ctx ? await ctx.json().catch(() => null) : null;
    console.log(`${target.slice(0, 64).padEnd(64)} -> ${ctx?.status ?? 'ERR'} ${(body as { error?: string } | null)?.error ?? error.message} (${Date.now() - t0} ms)`);
    return;
  }
  console.log(`${target.slice(0, 64).padEnd(64)} -> 200 ${data!.bytes} bytes, "${data!.text.slice(0, 15)}" (${Date.now() - t0} ms)`);
}

const arg = process.argv[2];
if (arg) await tryUrl(arg);
else {
  await tryUrl('https://calendar.google.com/calendar/ical/en.usa%23holiday%40group.v.calendar.google.com/public/basic.ics');
  await tryUrl('webcal://calendar.google.com/calendar/ical/en.usa%23holiday%40group.v.calendar.google.com/public/basic.ics');
  await tryUrl('https://169.254.169.254/latest/meta-data/');
  await tryUrl('https://example.com/');
  await tryUrl('not a url');
}
await supabase.auth.signOut();
