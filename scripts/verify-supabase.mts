/* eslint-disable no-console */
// Checks that the hosted Supabase project has everything the app needs. `npm run verify`
// Needs DATABASE_URL in .env (session pooler URI).
import 'dotenv/config';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set in .env');
  process.exit(1);
}
const db = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await db.connect();

let failures = 0;
function report(ok: boolean, label: string, detail = '') {
  if (!ok) failures += 1;
  console.log(`${ok ? '  ok  ' : '  MISSING'} ${label}${detail ? `  (${detail})` : ''}`);
}
async function rows<T = Record<string, any>>(sql: string): Promise<T[]> {
  try {
    return (await db.query(sql)).rows as T[];
  } catch (e: any) {
    return [{ __error: e.message } as T];
  }
}

console.log('migrations');
const migs = await rows<{ version: string; name: string }>(
  `select version, name from supabase_migrations.schema_migrations order by version`,
);
for (const m of migs) console.log(`       ${m.version}  ${m.name ?? ''}`);
report(migs.length >= 5 && !('__error' in migs[0]), 'all 5 migration files applied', `${migs.length} recorded`);

console.log('\nfunctions');
const expected = [
  'my_circle_id', 'same_circle', 'ensure_occurrences', 'personal_streak', 'circle_streak', 'detect_skips',
  'on_checkin_insert', 'on_skip_update', 'explain_skip', 'excuse_skip', 'excuse_occurrence', 'mark_forfeit_paid',
  'create_circle', 'join_circle', 'toggle_reaction', 'get_circle_state', 'handle_new_user',
  'dev_reset_demo', 'dev_start_class_now', 'dev_end_window_now', 'dev_set_demo_building',
  'dev_replay_checkin', 'dev_replay_explanation', 'dev_replay_pay_forfeit',
];
const fns = new Set((await rows<{ proname: string }>(`select proname from pg_proc where pronamespace = 'public'::regnamespace`)).map((r) => r.proname));
const missingFns = expected.filter((f) => !fns.has(f));
report(missingFns.length === 0, `${expected.length} functions present`, missingFns.length ? `missing: ${missingFns.join(', ')}` : '');

console.log('\nrow level security');
const tables = await rows<{ relname: string; relrowsecurity: boolean }>(
  `select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' order by relname`,
);
const noRls = tables.filter((t) => !t.relrowsecurity).map((t) => t.relname);
report(tables.length >= 12 && noRls.length === 0, `${tables.length} tables, RLS on all`, noRls.length ? `RLS off: ${noRls.join(', ')}` : '');

console.log('\ntriggers');
const trg = new Set((await rows<{ tgname: string }>(`select tgname from pg_trigger where not tgisinternal`)).map((r) => r.tgname));
for (const t of ['on_auth_user_created', 'classes_after_change', 'checkins_before_insert', 'skips_after_update']) report(trg.has(t), t);

console.log('\nstorage');
const bucket = await rows<{ id: string; public: boolean }>(`select id, public from storage.buckets where id = 'checkin-photos'`);
report(bucket.length === 1 && bucket[0].public === false, "private bucket 'checkin-photos'");
const pols = await rows<{ policyname: string }>(`select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'checkin photos%'`);
report(pols.length === 3, 'storage policies (upload / overwrite / read)', `${pols.length} of 3`);

console.log('\nrealtime');
const pub = (await rows<{ tablename: string }>(`select tablename from pg_publication_tables where pubname = 'supabase_realtime'`)).map((r) => r.tablename);
report(pub.includes('feed_events') && pub.includes('reactions'), 'supabase_realtime publishes feed_events + reactions', pub.join(', ') || 'none');

console.log('\ncron');
const jobs = await rows<{ jobname: string; schedule: string; active: boolean; __error?: string }>(`select jobname, schedule, active from cron.job order by jobname`);
if (jobs[0]?.__error) report(false, 'pg_cron', jobs[0].__error);
else {
  for (const j of jobs) console.log(`       ${j.jobname.padEnd(28)} ${j.schedule.padEnd(12)} ${j.active ? 'active' : 'INACTIVE'}`);
  report(jobs.filter((j) => j.jobname.startsWith('present-')).length === 3, '3 present-* cron jobs');
}

console.log('\nauth');
const users = await rows<{ n: string }>(`select count(*)::text as n from auth.users`);
const seedUsers = await rows<{ n: string }>(`select count(*)::text as n from auth.users where email like '%@present.demo'`);
console.log(`       ${users[0]?.n ?? '?'} users, ${seedUsers[0]?.n ?? '?'} seed users`);
const buildings = await rows<{ n: string }>(`select count(*)::text as n from public.buildings`);
console.log(`       ${buildings[0]?.n ?? '?'} buildings`);

await db.end();
console.log(failures ? `\n${failures} problem(s) above` : '\nall good');
process.exit(failures ? 1 : 0);
