/* eslint-disable no-console */
// Checks that the hosted Supabase project has everything the v2 app needs. `npm run verify`
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
const migs = await rows<{ version: string; name: string }>(`select version, name from supabase_migrations.schema_migrations order by version`);
for (const m of migs) console.log(`       ${m.version}  ${m.name ?? ''}`);
const v2 = migs.filter((m) => m.version?.startsWith('20260913'));
const v1 = migs.filter((m) => m.version?.startsWith('20260912'));
report(v2.length >= 5 && v1.length === 0 && !('__error' in migs[0]), 'v2 migration files applied, no v1 left', `${v2.length} v2, ${v1.length} v1`);

console.log('\nfunctions');
const expected = [
  'app_now', 'valid_tz', 'pick_username', 'handle_new_user', 'on_class_before_write',
  'local_today', 'my_tz', 'my_today', 'friends_of', 'visible_users', 'event_visible', 'haversine_m', 'profile_json',
  'ensure_occurrences', 'ensure_my_occurrences', 'on_class_change', 'personal_streak', 'best_streak',
  'create_post_for', 'create_post', 'detect_misses', 'on_miss_update', 'explain_miss', 'excuse_miss', 'excuse_occurrence',
  'username_available', 'send_friend_request', 'accept_friend_request', 'remove_friend', 'search_users', 'update_profile',
  'toggle_reaction', 'add_comment', 'import_classes', 'get_state', 'get_memories', 'expire_photos',
  'save_push_subscription', 'remove_push_subscription',
  'get_stats', 'stats_for',
  'my_group_ids', 'group_mates', 'is_group_member', 'gen_invite_code', 'miss_group_excused', 'void_forfeit', 'on_miss_group_effects',
  'group_days', 'group_streak', 'group_best_streak', 'group_json', 'group_state', 'check_miss_in_group',
  'create_group', 'join_group', 'add_to_group', 'leave_group', 'update_group', 'mark_forfeit_paid', 'vote_miss', 'vouch_miss',
  'dev_scope', 'dev_reset_demo', 'dev_start_class_now', 'dev_end_on_time_now', 'dev_end_window_now', 'dev_pin_here',
  'dev_replay_post', 'dev_replay_explanation',
];
const fns = new Set((await rows<{ proname: string }>(`select proname from pg_proc where pronamespace = 'public'::regnamespace`)).map((r) => r.proname));
const missingFns = expected.filter((f) => !fns.has(f));
const v1Fns = ['get_circle_state', 'detect_skips', 'my_circle_id', 'create_circle'].filter((f) => fns.has(f));
report(missingFns.length === 0 && v1Fns.length === 0, `${expected.length} functions present, no v1 leftovers`, [missingFns.length ? `missing: ${missingFns.join(', ')}` : '', v1Fns.length ? `v1: ${v1Fns.join(', ')}` : ''].filter(Boolean).join('; '));

console.log('\nrow level security');
const tables = await rows<{ relname: string; relrowsecurity: boolean }>(
  `select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' order by relname`,
);
const expectedTables = ['profiles', 'friendships', 'classes', 'class_occurrences', 'posts', 'misses', 'feed_events', 'reactions', 'comments', 'push_subscriptions', 'groups', 'group_members', 'group_forfeits', 'miss_votes', 'miss_vouches'];
const names = new Set(tables.map((t) => t.relname));
const missingTables = expectedTables.filter((t) => !names.has(t));
const noRls = tables.filter((t) => !t.relrowsecurity).map((t) => t.relname);
report(missingTables.length === 0 && noRls.length === 0 && tables.length === expectedTables.length, `${tables.length} tables, RLS on all`, [missingTables.length ? `missing: ${missingTables.join(', ')}` : '', noRls.length ? `RLS off: ${noRls.join(', ')}` : ''].filter(Boolean).join('; '));
const pols = await rows<{ n: string }>(`select count(*)::text as n from pg_policies where schemaname = 'public'`);
report(Number(pols[0]?.n) >= 14, `${pols[0]?.n} policies`);

console.log('\ntriggers');
const trg = new Set((await rows<{ tgname: string }>(`select tgname from pg_trigger where not tgisinternal`)).map((r) => r.tgname));
for (const t of ['on_auth_user_created', 'classes_before_write', 'classes_after_change', 'misses_after_update']) report(trg.has(t), t);

console.log('\nstorage');
const bucket = await rows<{ id: string; public: boolean }>(`select id, public from storage.buckets where id = 'checkin-photos'`);
report(bucket.length === 1 && bucket[0].public === false, "private bucket 'checkin-photos'");
const spols = await rows<{ policyname: string }>(`select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'checkin photos%'`);
report(spols.length === 3, 'storage policies (upload / overwrite / read)', `${spols.length} of 3`);

console.log('\nrealtime');
const pub = (await rows<{ tablename: string }>(`select tablename from pg_publication_tables where pubname = 'supabase_realtime'`)).map((r) => r.tablename);
const needPub = ['feed_events', 'reactions', 'comments', 'friendships', 'groups', 'group_members', 'group_forfeits', 'miss_votes', 'miss_vouches'];
report(needPub.every((t) => pub.includes(t)), 'supabase_realtime publishes feed, reactions, comments, friendships, groups', pub.join(', ') || 'none');

console.log('\ncron');
const jobs = await rows<{ jobname: string; schedule: string; active: boolean; __error?: string }>(`select jobname, schedule, active from cron.job order by jobname`);
if (jobs[0]?.__error) report(false, 'pg_cron', jobs[0].__error);
else {
  for (const j of jobs) console.log(`       ${j.jobname.padEnd(28)} ${j.schedule.padEnd(12)} ${j.active ? 'active' : 'INACTIVE'}`);
  const present = jobs.filter((j) => j.jobname.startsWith('present-')).map((j) => j.jobname);
  report(['present-detect-misses', 'present-ensure-occurrences', 'present-expire-photos'].every((j) => present.includes(j)) && present.length === 3, '3 present-* cron jobs');
}

console.log('\nauth');
const users = await rows<{ n: string }>(`select count(*)::text as n from auth.users`);
const seedUsers = await rows<{ n: string }>(`select count(*)::text as n from auth.users where email like '%@present.demo'`);
const profiles = await rows<{ n: string }>(`select count(*)::text as n from public.profiles`);
console.log(`       ${users[0]?.n ?? '?'} users, ${seedUsers[0]?.n ?? '?'} seed users, ${profiles[0]?.n ?? '?'} profiles`);
const friends = await rows<{ n: string }>(`select count(*)::text as n from public.friendships where status = 'accepted'`);
const posts = await rows<{ n: string }>(`select count(*)::text as n from public.posts`);
console.log(`       ${friends[0]?.n ?? '?'} friendships, ${posts[0]?.n ?? '?'} posts`);

await db.end();
console.log(failures ? `\n${failures} problem(s) above` : '\nall good');
process.exit(failures ? 1 : 0);
