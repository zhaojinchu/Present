/* eslint-disable no-console */
// Signs in as a seed account and checks that the hosted get_state() matches the web app's zod
// contract (web/src/lib/types.ts). Catches backend/client drift without a phone.  `npm run smoke`
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppState } from '../web/src/lib/types.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anon) {
  console.error('SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY must be set in .env');
  process.exit(1);
}
const specPath = fs.existsSync(path.join(here, 'seed', 'schedules.json')) ? path.join(here, 'seed', 'schedules.json') : path.join(here, 'seed', 'schedules.example.json');
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8')) as { password: string; members: { first: string }[] };
const who = process.argv[2] ?? spec.members[0].first;

const supabase = createClient(url, anon, { auth: { persistSession: false } });
const { error: authErr } = await supabase.auth.signInWithPassword({ email: `${who}@present.demo`, password: spec.password });
if (authErr) {
  console.error('sign-in failed:', authErr.message);
  process.exit(1);
}
const t0 = Date.now();
const { data, error } = await supabase.rpc('get_state');
if (error) {
  console.error('get_state failed:', error.message);
  process.exit(1);
}
const parsed = AppState.safeParse(data);
if (!parsed.success) {
  console.error('get_state does not match web/src/lib/types.ts:');
  for (const i of parsed.error.issues.slice(0, 10)) console.error(`  ${i.path.join('.')}: ${i.message}`);
  process.exit(1);
}
const s = parsed.data;
console.log(`get_state as @${s.me.username} in ${Date.now() - t0} ms`);
console.log(`  today ${s.today}, streak ${s.me.streak}, best ${s.me.best_streak}, posts ${s.me.posts_count}, classes ${s.me.class_count}, posted_today ${s.me.posted_today}`);
console.log(`  friends: ${s.friends.map((f) => `@${f.username} ${f.streak}`).join(', ')}`);
console.log(`  today_occurrences ${s.today_occurrences.length} (${s.today_occurrences.filter((o) => o.user_id === s.me.id).length} mine)`);
console.log(`  feed ${s.feed.length} (${s.feed.filter((e) => e.type === 'post').length} posts, ${s.feed.filter((e) => e.type === 'miss').length} misses), reactions ${s.reactions.length}, comments ${s.comments.length}`);
console.log(`  unexplained misses ${s.my_unexplained_misses.length}, requests in/out ${s.requests.incoming.length}/${s.requests.outgoing.length}`);
await supabase.auth.signOut();
console.log('contract ok');
