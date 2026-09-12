/* eslint-disable no-console */
// Exercises groups (20260913000009_groups.sql) in PGlite with the same stub auth schema and frozen
// clock as sql-test.mts. Self-contained: `tsx scripts/sql-test-groups.mts` (npm run sql:test runs it).
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
async function fails(sql: string, params: unknown[], needle: string) {
  await assert.rejects(q(sql, params), (e: Error) => {
    assert.ok(e.message.includes(needle), `expected "${needle}" in: ${e.message}`);
    return true;
  });
}
async function as(userId: string | null) {
  await q(`select set_config('request.jwt.claim.sub', $1, false)`, [userId ?? '']);
}
async function setClock(iso: string) {
  await q(`select set_config('present.now', $1, false)`, [iso]);
}
const state = () => scalar<Row>(`select public.get_state()`);

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

// Mon 14 .. Thu 17 Sep 2026. Class 09:30 to 10:20 New York = 13:30Z to 14:20Z; opens 13:28Z, on time
// until 13:40Z, deadline 14:30Z.
const DAYS = ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17'];
const [MON, TUE, WED, THU] = DAYS;
await setClock(`${MON}T12:00:00Z`);

async function addUser(email: string, meta: Record<string, string>) {
  return (await one<{ id: string }>(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`, [email, JSON.stringify(meta)])).id;
}
const alex = await addUser('alex@present.demo', { display_name: 'Alex Chen', username: 'alex', tz: 'America/New_York' });
const sam = await addUser('sam@present.demo', { display_name: 'Sam Okafor', username: 'sam', tz: 'America/New_York' });
const priya = await addUser('priya@present.demo', { display_name: 'Priya Nair', username: 'priya', tz: 'America/New_York' });
const out = await addUser('out@present.demo', { display_name: 'Out Sider', username: 'outsider', tz: 'America/New_York' });

async function befriend(a: string, bUsername: string, b: string) {
  await as(a);
  await q(`select public.send_friend_request($1)`, [bUsername]);
  await as(b);
  await q(`select public.accept_friend_request($1)`, [a]);
}
await befriend(alex, 'sam', sam);
await befriend(alex, 'priya', priya);

async function addClass(user: string, course: string) {
  return (
    await one<{ id: string }>(
      `insert into public.classes (user_id, course_code, name, location_text, days_of_week, start_time, end_time)
       values ($1, $2, 'Imperative Computation', 'GHC 4401', '{1,2,3,4}', '09:30', '10:20') returning id`,
      [user, course],
    )
  ).id;
}
for (const u of [alex, sam, out]) await addClass(u, '15-122');
await addClass(priya, '21-241');

async function ensureDay(day: string) {
  await setClock(`${day}T12:00:00Z`);
  for (const u of [alex, sam, priya, out]) await q(`select public.ensure_occurrences($1::date, 1, null, $2)`, [day, u]);
}
async function occOf(u: string, day: string) {
  return (await one(`select id from public.class_occurrences where user_id = $1 and date = $2`, [u, day])).id as string;
}
async function postOnTime(u: string, day: string) {
  await as(u);
  await setClock(`${day}T13:32:00Z`);
  const r = await scalar<Row>(`select public.create_post($1, $2)`, [await occOf(u, day), `${u}/${day}.jpg`]);
  assert.equal(r.late, false);
}
async function missOf(u: string, day: string) {
  return (await one(`select m.id from public.misses m join public.class_occurrences o on o.id = m.occurrence_id where m.user_id = $1 and o.date = $2`, [u, day])).id as string;
}
async function myGroup(id: string) {
  const s = await state();
  const g = s.groups.find((x: Row) => x.id === id);
  assert.ok(g, 'group in get_state');
  return g as Row;
}

await ensureDay(MON);
let g: Row;

console.log('\nmembership');
await test('create, join by code (non-friend), add a friend, limits, update', async () => {
  await as(alex);
  await fails(`select public.create_group($1)`, ['  '], 'Give the group a name');
  g = await scalar<Row>(`select public.create_group('Study crew', '🔥', 'buys the group boba')`);
  assert.equal(g.name, 'Study crew');
  assert.equal(g.emoji, '🔥');
  assert.equal(g.forfeit_text, 'buys the group boba');
  assert.match(g.invite_code, /^[A-Z0-9]{6}$/);
  assert.equal(g.created_by, alex);
  assert.equal(g.members.length, 1);
  assert.equal(g.members[0].username, 'alex');
  assert.equal(g.streak, 0);
  assert.deepEqual(Object.keys(g.week).sort(), ['late', 'made', 'missed', 'on_time', 'total', 'upcoming']);
  assert.equal(g.standings.length, 1);
  assert.deepEqual(g.forfeits, []);
  assert.deepEqual(g.excused_miss_ids, []);

  // the outsider is nobody's friend but has the code
  await as(out);
  await fails(`select public.join_group('ZZZZZZ')`, [], 'No group has that code');
  let j = await scalar<Row>(`select public.join_group($1)`, [g.invite_code.toLowerCase()]);
  assert.equal(j.members.length, 2);
  j = await scalar<Row>(`select public.join_group($1)`, [g.invite_code]);
  assert.equal(j.members.length, 2, 'joining twice is a no-op');
  await fails(`select public.add_to_group($1, $2)`, [g.id, priya], 'You can only add friends');

  await as(sam);
  await fails(`select public.add_to_group($1, $2)`, [g.id, priya], 'You are not in this group');
  await fails(`select public.group_state($1)`, [g.id], 'You are not in this group');

  await as(alex);
  const a = await scalar<Row>(`select public.add_to_group($1, $2)`, [g.id, sam]);
  assert.deepEqual(a.members.map((m: Row) => m.username), ['alex', 'outsider', 'sam']);

  await as(sam);
  await fails(`select public.update_group($1, 'Nope')`, [g.id], 'Only the person who made the group');
  await as(alex);
  const u = await scalar<Row>(`select public.update_group($1, '', '📚', '')`, [g.id]);
  assert.equal(u.name, 'Study crew', 'empty name keeps the old one');
  assert.equal(u.emoji, '📚');
  assert.equal(u.forfeit_text, null, 'empty forfeit clears it');
  await q(`select public.update_group($1, 'Study crew', '🔥', 'buys the group boba')`, [g.id]);

  // 8 people max
  const full = await scalar<Row>(`select public.create_group('Full house')`);
  const extras: string[] = [];
  for (let i = 0; i < 8; i++) extras.push(await addUser(`x${i}@present.demo`, { display_name: `X ${i}`, username: `x${i}`, tz: 'UTC' }));
  for (let i = 0; i < 7; i++) {
    await as(extras[i]);
    await q(`select public.join_group($1)`, [full.invite_code]);
  }
  await as(extras[7]);
  await fails(`select public.join_group($1)`, [full.invite_code], 'full');
  await as(alex);
  await fails(`select public.add_to_group($1, $2)`, [full.id, sam], 'full');
});

await test('co-members see each other; friends stay friends-only; RLS on the tables', async () => {
  await as(out);
  let s = await state();
  assert.deepEqual(s.friends, [], 'the outsider has no friends');
  const seen = new Set(s.today_occurrences.map((o: Row) => o.user_id));
  assert.ok(seen.has(alex) && seen.has(sam), "co-members' classes are visible");
  assert.ok(!seen.has(priya), 'priya is in no group with the outsider');
  assert.equal(s.groups.length, 1);
  assert.deepEqual(s.shared_courses, [], 'suggestions only count friends');

  await as(alex);
  s = await state();
  assert.deepEqual(s.friends.map((f: Row) => f.username).sort(), ['priya', 'sam'], 'no co-member in the friends list');
  assert.ok(s.today_occurrences.some((o: Row) => o.user_id === out), 'but their classes show');
  assert.equal(s.groups.length, 2);
  assert.deepEqual(s.shared_courses, [{ course_code: '15-122', name: 'Imperative Computation', user_ids: [sam] }]);

  await q(`set role authenticated`);
  await as(out);
  assert.equal(await scalar(`select count(*)::int from public.groups`), 1);
  assert.equal(await scalar(`select count(*)::int from public.group_members`), 3);
  await as(priya);
  assert.equal(await scalar(`select count(*)::int from public.groups`), 0);
  assert.equal(await scalar(`select count(*)::int from public.group_members`), 0);
  await q(`reset role`);
});

console.log('\nstakes, votes, vouches, streak');
let f1: Row;
await test('a miss owes the forfeit; a co-member marks it paid; the group streak breaks', async () => {
  await postOnTime(alex, MON);
  await postOnTime(out, MON);
  await setClock(`${MON}T14:31:00Z`);
  assert.equal(await scalar(`select public.detect_misses()`), 2, 'sam and priya');
  await as(alex);
  let gg = await myGroup(g.id);
  assert.equal(gg.forfeits.length, 1, 'one forfeit, none for priya (no group)');
  f1 = gg.forfeits[0];
  assert.equal(f1.user_id, sam);
  assert.equal(f1.status, 'owed');
  assert.equal(f1.course_code, '15-122');
  assert.equal(f1.miss_id, await missOf(sam, MON));
  assert.equal(gg.streak, 0);
  assert.equal(gg.best_streak, 0);

  await as(sam);
  await fails(`select public.mark_forfeit_paid($1)`, [f1.id], 'Someone else has to confirm');
  await as(priya);
  await fails(`select public.mark_forfeit_paid($1)`, [f1.id], 'No such forfeit');
  await as(alex);
  const paid = await scalar<Row>(`select public.mark_forfeit_paid($1)`, [f1.id]);
  assert.equal(paid.status, 'paid');
  assert.equal(paid.paid_by, alex);
  await fails(`select public.mark_forfeit_paid($1)`, [f1.id], 'already paid');
  gg = await myGroup(g.id);
  assert.equal(gg.forfeits[0].status, 'paid');
});

await test('excuse voting: a majority of the other members excuses the miss and voids the forfeit', async () => {
  await ensureDay(TUE);
  await postOnTime(alex, TUE);
  await postOnTime(out, TUE);
  await setClock(`${TUE}T14:31:00Z`);
  await q(`select public.detect_misses()`);
  const m2 = await missOf(sam, TUE);

  await as(sam);
  await fails(`select public.vote_miss($1, $2, true)`, [m2, g.id], 'your own miss');
  await as(priya);
  await fails(`select public.vote_miss($1, $2, true)`, [m2, g.id], 'You are not in this group');
  await as(alex);
  await fails(`select public.vote_miss($1, $2, true)`, [await missOf(priya, TUE), g.id], 'not in this group');

  let v = await scalar<Row>(`select public.vote_miss($1, $2, true)`, [m2, g.id]);
  assert.equal(v.excused, false, '1 of 2 others is not a majority');
  assert.equal(v.fair, 1);
  await as(out);
  v = await scalar<Row>(`select public.vote_miss($1, $2, false)`, [m2, g.id]);
  assert.equal(v.excused, false);
  assert.equal(v.unfair, 1);
  v = await scalar<Row>(`select public.vote_miss($1, $2, true)`, [m2, g.id]);
  assert.equal(v.excused, true, 'changed my mind: 2 of 2');
  assert.equal(v.fair, 2);
  assert.equal(v.unfair, 0);

  const gg = await myGroup(g.id);
  const f2 = gg.forfeits.find((f: Row) => f.miss_id === m2);
  assert.equal(f2.status, 'voided');
  assert.deepEqual(gg.excused_miss_ids, [m2]);
  assert.equal(gg.votes.filter((x: Row) => x.miss_id === m2).length, 2);
  assert.equal(gg.streak, 1, 'Mon broken, Tue complete');
  assert.equal(gg.best_streak, 1);
  assert.equal(await scalar(`select public.personal_streak($1)`, [sam]), 0, 'personal streak ignores group excuses');
  assert.equal(await scalar(`select status::text from public.class_occurrences where id = (select occurrence_id from public.misses where id = $1)`, [m2]), 'missed');
});

await test('vouch excuses at once; the misser\'s own excuse voids the forfeit too', async () => {
  await ensureDay(WED);
  await postOnTime(alex, WED);
  await postOnTime(out, WED);
  await setClock(`${WED}T14:31:00Z`);
  await q(`select public.detect_misses()`);
  const m3 = await missOf(sam, WED);
  await as(sam);
  await fails(`select public.vouch_miss($1, $2)`, [m3, g.id], 'your own miss');
  await as(alex);
  const v = await scalar<Row>(`select public.vouch_miss($1, $2)`, [m3, g.id]);
  assert.equal(v.excused, true);
  await q(`select public.vouch_miss($1, $2)`, [m3, g.id]); // idempotent
  let gg = await myGroup(g.id);
  assert.equal(gg.forfeits.find((f: Row) => f.miss_id === m3).status, 'voided');
  assert.deepEqual(gg.vouches, [{ miss_id: m3, voucher_id: alex }]);
  assert.ok(gg.excused_miss_ids.includes(m3));
  assert.equal(gg.streak, 2);

  await ensureDay(THU);
  await postOnTime(alex, THU);
  await postOnTime(out, THU);
  await setClock(`${THU}T14:31:00Z`);
  await q(`select public.detect_misses()`);
  const m4 = await missOf(sam, THU);
  await as(alex);
  gg = await myGroup(g.id);
  assert.equal(gg.forfeits.find((f: Row) => f.miss_id === m4).status, 'owed');
  assert.equal(gg.streak, 0, 'an unexcused miss today breaks it');
  await as(sam);
  await q(`select public.excuse_miss($1)`, [m4]);
  await as(alex);
  gg = await myGroup(g.id);
  assert.equal(gg.forfeits.find((f: Row) => f.miss_id === m4).status, 'voided', 'self-excuse voids');
  assert.equal(gg.streak, 3, 'Tue, Wed, Thu');
  assert.equal(gg.best_streak, 3);
});

await test('week, standings, members in get_state', async () => {
  await as(alex);
  const gg = await myGroup(g.id);
  assert.deepEqual(gg.week, { made: 8, total: 11, on_time: 8, late: 0, missed: 3, upcoming: 0 });
  assert.equal(gg.standings.length, 3);
  const last = gg.standings[2];
  assert.equal(last.id, sam);
  assert.deepEqual(last, { id: sam, made: 0, total: 3, on_time: 0, late: 0, missed: 3 });
  assert.deepEqual(gg.standings[0], { id: gg.standings[0].id, made: 4, total: 4, on_time: 4, late: 0, missed: 0 });
  const me = gg.members.find((m: Row) => m.id === alex);
  assert.equal(me.streak, 4);
  assert.equal(me.posted_today, true);
  const s = gg.members.find((m: Row) => m.id === sam);
  assert.equal(s.streak, 1, 'personal streak: the self-excused Thursday counts as complete');
  assert.equal(s.posted_today, false);
  assert.equal(gg.forfeits.length, 4);

  await as(sam);
  const mine = await myGroup(g.id);
  assert.equal(mine.forfeits.find((f: Row) => f.id === f1.id).status, 'paid');
});

await test('leaving: the last one out deletes the group', async () => {
  await as(priya);
  await fails(`select public.leave_group($1)`, [g.id], 'You are not in this group');
  await as(out);
  assert.equal(await scalar(`select public.leave_group($1)`, [g.id]), false);
  await as(sam);
  assert.equal(await scalar(`select public.leave_group($1)`, [g.id]), false);
  await as(alex);
  assert.equal((await state()).groups.find((x: Row) => x.id === g.id).members.length, 1);
  assert.equal(await scalar(`select public.leave_group($1)`, [g.id]), true);
  assert.equal(await scalar(`select count(*)::int from public.groups where id = $1`, [g.id]), 0);
  assert.equal(await scalar(`select count(*)::int from public.group_forfeits where group_id = $1`, [g.id]), 0);
  assert.equal(await scalar(`select count(*)::int from public.misses where user_id = $1`, [sam]), 4, 'misses themselves stay');
});

console.log(`\n${passed} tests passed`);
await db.close();
