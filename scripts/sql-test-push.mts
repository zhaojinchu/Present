/* eslint-disable no-console */
// Exercises the push queue (20260913000012_push.sql) in PGlite: what gets queued, for whom, once.
// Delivery (000013) is hosted-only and not covered here.
import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, '..', 'supabase', 'migrations');
const db = new PGlite();
let passed = 0;
async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (e) {
    console.log(`  FAIL ${name}`);
    throw e;
  }
}
type Row = Record<string, any>;
async function q<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows;
}
async function one<T = Row>(sql: string, params: unknown[] = []): Promise<T> {
  const rows = await q<T>(sql, params);
  assert.equal(rows.length, 1, `expected one row from: ${sql}`);
  return rows[0];
}
async function scalar<T = any>(sql: string, params: unknown[] = []): Promise<T> {
  return Object.values(await one<Row>(sql, params))[0] as T;
}
const as = (userId: string | null) => q(`select set_config('request.jwt.claim.sub', $1, false)`, [userId ?? '']);
const setClock = (iso: string) => q(`select set_config('present.now', $1, false)`, [iso]);
const queued = (user: string) => q(`select title, body, url, tag from public.push_queue where user_id = $1 order by created_at`, [user]);

await db.exec(`
  create schema if not exists auth;
  create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb not null default '{}'::jsonb);
  create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create or replace function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $$;
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  end $$;
  grant usage on schema public to anon, authenticated, service_role;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  grant execute on function auth.role() to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`);
for (const f of fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql') && !f.includes('supabase_only')).sort()) {
  process.stdout.write(`migrating ${f} ... `);
  await db.exec(fs.readFileSync(path.join(migrationsDir, f), 'utf8'));
  console.log('ok');
}

const MON = '2026-09-14';
await setClock(`${MON}T12:00:00Z`);
const addUser = async (email: string, meta: Record<string, string>) => (await one<{ id: string }>(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`, [email, JSON.stringify(meta)])).id;
const alex = await addUser('alex@present.demo', { display_name: 'Alex Chen', username: 'alex', tz: 'America/New_York' });
const sam = await addUser('sam@present.demo', { display_name: 'Sam Okafor', username: 'sam', tz: 'America/New_York' });

console.log('\npush queue');
await test('friend request and acceptance notify the right person, once', async () => {
  await as(alex);
  await q(`select public.send_friend_request('sam')`);
  let s = await queued(sam);
  assert.equal(s.length, 1);
  assert.equal(s[0].title, 'Friend request');
  assert.match(s[0].body, /Alex Chen \(@alex\)/);
  assert.equal(s[0].url, '/friends');
  assert.deepEqual(await queued(alex), []);
  await as(sam);
  await q(`select public.accept_friend_request($1)`, [alex]);
  const a = await queued(alex);
  assert.equal(a.length, 1);
  assert.equal(a[0].title, 'You and Sam are friends');
  assert.equal(a[0].url, '/u/sam');
  s = await queued(sam);
  assert.equal(s.length, 1, 'accepting does not notify the accepter');
});

await test('a window opening is queued once; a miss and a comment reach the owner', async () => {
  await q(
    `insert into public.classes (user_id, course_code, name, location_text, days_of_week, start_time, end_time) values ($1, '15-122', 'Imperative Computation', 'GHC 4401', '{1}', '09:30', '10:20')`,
    [sam],
  );
  await q(`select public.ensure_occurrences($1::date, 1, null, $2)`, [MON, sam]);
  const occ = await one(`select id from public.class_occurrences where user_id = $1 and date = $2`, [sam, MON]);
  await setClock(`${MON}T13:27:00Z`);
  await q(`select public.enqueue_open_windows()`);
  assert.equal((await queued(sam)).length, 1, 'not open yet');
  await setClock(`${MON}T13:29:00Z`);
  await q(`select public.enqueue_open_windows()`);
  await q(`select public.enqueue_open_windows()`);
  let s = await queued(sam);
  assert.equal(s.length, 2, 'queued once across two runs');
  assert.equal(s[1].title, '15-122 is open');
  assert.match(s[1].body, /11 min to stay on time/);
  assert.equal(s[1].url, `/post/${occ.id}`);
  assert.equal(s[1].tag, `open:${occ.id}`);

  await setClock(`${MON}T14:31:00Z`);
  await q(`select public.detect_misses()`);
  const miss = await one(`select id from public.misses where user_id = $1`, [sam]);
  s = await queued(sam);
  assert.equal(s.length, 3);
  assert.equal(s[2].title, 'You missed 15-122');
  assert.equal(s[2].url, `/explain/${miss.id}`);

  const ev = await one(`select id from public.feed_events where type = 'miss' and ref_id = $1`, [miss.id]);
  await as(sam);
  await q(`select public.explain_miss($1, 'overslept')`, [miss.id]);
  assert.equal((await queued(sam)).length, 3, 'your own explanation does not notify you');
  await as(alex);
  await q(`select public.add_comment($1, 'classic')`, [ev.id]);
  s = await queued(sam);
  assert.equal(s.length, 4);
  assert.equal(s[3].title, 'Alex commented on your miss');
  assert.equal(s[3].body, 'classic');
  assert.equal(s[3].url, `/comments/${ev.id}`);

  await as(sam);
  await q(`select public.excuse_occurrence($1, 'x')`, [(await one(`select id from public.class_occurrences where user_id = $1 and date = $2`, [sam, MON])).id]).catch(() => undefined);
  await q(`set role authenticated`);
  assert.equal(await scalar(`select count(*)::int from public.push_queue`), 0, 'clients cannot read the queue');
  await q(`reset role`);
});

console.log(`\n${passed} tests passed`);
await db.close();
