/* eslint-disable no-console */
// Exercises get_stats() (20260913000007_social.sql, minus the RPCs dropped in 000008) in PGlite with the same
// stub auth schema and frozen clock as sql-test.mts. Self-contained so it can run on its own:
// `tsx scripts/sql-test-social.mts` (npm run sql:test runs both).
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
  const r = await db.query<T>(sql, params);
  return r.rows;
}
async function one<T = Row>(sql: string, params: unknown[] = []): Promise<T> {
  const rows = await q<T>(sql, params);
  assert.equal(rows.length, 1, `expected one row from: ${sql}`);
  return rows[0];
}
async function scalar<T = any>(sql: string, params: unknown[] = []): Promise<T> {
  const row = await one<Row>(sql, params);
  return Object.values(row)[0] as T;
}
async function as(userId: string | null) {
  await q(`select set_config('request.jwt.claim.sub', $1, false)`, [userId ?? '']);
}
async function setClock(iso: string) {
  await q(`select set_config('present.now', $1, false)`, [iso]);
}
// ---------------------------------------------------------------- bootstrap: Supabase stubs (same as sql-test.mts)

await db.exec(`
  create schema if not exists auth;
  create table if not exists auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );
  create or replace function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create or replace function auth.role() returns text language sql stable as
    $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $$;
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

const files = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql') && !f.includes('supabase_only'))
  .sort();
for (const f of files) {
  process.stdout.write(`migrating ${f} ... `);
  await db.exec(fs.readFileSync(path.join(migrationsDir, f), 'utf8'));
  console.log('ok');
}

// Monday 14 Sep 2026. Class 09:30 to 10:20 New York = 13:30Z to 14:20Z; opens 13:28Z, on time until
// 13:40Z, deadline 14:30Z.
const MON = '2026-09-14';
await setClock(`${MON}T12:00:00Z`);

async function addUser(email: string, meta: Record<string, string>) {
  return (await one<{ id: string }>(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`, [email, JSON.stringify(meta)])).id;
}
const alex = await addUser('alex@present.demo', { display_name: 'Alex Chen', username: 'alex', tz: 'America/New_York' });
const sam = await addUser('sam@present.demo', { display_name: 'Sam Okafor', username: 'sam', tz: 'America/New_York' });
const outsider = await addUser('out@present.demo', { display_name: 'Out Sider', username: 'outsider', tz: 'America/New_York' });

await as(alex);
await q(`select public.send_friend_request('sam')`);
await as(sam);
await q(`select public.accept_friend_request($1)`, [alex]);

async function addClass(user: string, course: string) {
  return (
    await one<{ id: string }>(
      `insert into public.classes (user_id, course_code, name, location_text, days_of_week, start_time, end_time)
       values ($1, $2, 'Imperative Computation', 'GHC 4401', '{1}', '09:30', '10:20') returning id`,
      [user, course],
    )
  ).id;
}
for (const u of [alex, sam, outsider]) {
  await addClass(u, '15-122');
  await q(`select public.ensure_occurrences($1::date, 1, null, $2)`, [MON, u]);
}
async function occOf(u: string) {
  return (await one(`select id from public.class_occurrences where user_id = $1 and date = $2`, [u, MON])).id as string;
}
const alexOcc = await occOf(alex);

console.log('\nstats');
await test('week and term numbers for me and friends', async () => {
  await as(alex);
  await setClock(`${MON}T13:32:00Z`);
  const post = await scalar<Row>(`select public.create_post($1, 'alex/1.jpg')`, [alexOcc]);
  assert.equal(post.late, false);
  assert.equal(await scalar(`select count(*)::int from pg_proc where proname in ('head_out', 'nudge')`), 0, 'retired RPCs are gone');
  const s = await scalar<Row>(`select public.get_stats()`);
  assert.equal(s.week_start, MON);
  assert.equal(s.me.id, alex);
  assert.equal(s.me.week_on_time, 1);
  assert.equal(s.me.week_late, 0);
  assert.equal(s.me.week_total, 1);
  assert.equal(s.me.week_upcoming, 0);
  assert.equal(s.me.minutes_in_class, 50);
  assert.equal(s.me.term_posted, 1);
  assert.equal(s.friends.length, 1, 'friends only, no outsider');
  assert.equal(s.friends[0].username, 'sam');
  assert.equal(s.friends[0].week_upcoming, 1, "sam's class is still pending");
  assert.equal(s.friends[0].week_total, 0);

  // Sam never posts: past the deadline it counts as missed even before detect_misses runs.
  await setClock(`${MON}T14:31:00Z`);
  let t = await scalar<Row>(`select public.get_stats()`);
  assert.equal(t.friends[0].week_missed, 1);
  assert.equal(t.friends[0].week_total, 1);
  assert.equal(await scalar(`select public.detect_misses()`), 2, 'sam and the outsider');
  t = await scalar<Row>(`select public.get_stats()`);
  assert.equal(t.friends[0].week_missed, 1);
  assert.equal(t.friends[0].week_upcoming, 0);

  await as(outsider);
  const o = await scalar<Row>(`select public.get_stats()`);
  assert.equal(o.friends.length, 0);
  assert.equal(o.me.week_missed, 1);
});

console.log(`\n${passed} tests passed`);
await db.close();
