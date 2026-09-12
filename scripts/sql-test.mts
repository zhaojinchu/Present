/* eslint-disable no-console */
// Runs the v2 migrations in an in-process Postgres (PGlite) with a stub `auth` schema and
// exercises the whole product: friends, calendar import, the on-time/late/miss window, excuses,
// streaks, get_state, reactions, comments, photo expiry, the demo controls and RLS.
// The clock is injectable (present.now), so this passes at any hour.  `npm run sql:test`
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
async function expectError(p: Promise<unknown>, contains: string) {
  try {
    await p;
  } catch (e: any) {
    assert.ok(String(e.message).includes(contains), `expected error containing "${contains}", got: ${e.message}`);
    return;
  }
  assert.fail(`expected an error containing "${contains}"`);
}
const ms = (iso: string) => new Date(iso).getTime();

// ---------------------------------------------------------------- bootstrap: Supabase stubs

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

// Monday 14 Sep 2026, 09:00 in New York (13:00Z, 14:00 in London).
const MON = '2026-09-14';
const FRI = '2026-09-18';
await setClock(`${MON}T13:00:00Z`);

// ---------------------------------------------------------------- fixtures

async function addUser(email: string, meta: Record<string, string>) {
  return (await one<{ id: string }>(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`, [email, JSON.stringify(meta)])).id;
}
const alex = await addUser('alex@present.demo', { display_name: 'Alex Chen', username: 'alex', tz: 'America/New_York' });
const sam = await addUser('sam@present.demo', { display_name: 'Sam Okafor', username: 'sam', tz: 'America/New_York' });
const priya = await addUser('priya@present.demo', { display_name: 'Priya Natarajan', username: 'priya', tz: 'America/New_York' });
const jordan = await addUser('jordan@present.demo', { display_name: 'Jordan Lee', username: 'jordan', tz: 'Europe/London' });
const outsider = await addUser('out@present.demo', { display_name: 'Out Sider', username: 'outsider', tz: 'Mars/Phobos' });
const alex2 = await addUser('alex.two@present.demo', { display_name: 'Alex Two', username: 'alex' });

console.log('\nprofiles');
await test('auth.users insert creates profiles; usernames unique; bad tz falls back to UTC', async () => {
  assert.equal(await scalar(`select count(*)::int from public.profiles`), 6);
  assert.equal(await scalar(`select username from public.profiles where id = $1`, [alex]), 'alex');
  assert.match(await scalar<string>(`select username from public.profiles where id = $1`, [alex2]), /^alex\d{3}$/);
  assert.equal(await scalar(`select tz from public.profiles where id = $1`, [jordan]), 'Europe/London');
  assert.equal(await scalar(`select tz from public.profiles where id = $1`, [outsider]), 'UTC');
  await as(sam);
  assert.equal(await scalar(`select public.username_available('alex')`), false);
  assert.equal(await scalar(`select public.username_available('Alex')`), false);
  assert.equal(await scalar(`select public.username_available('newname')`), true);
  assert.equal(await scalar(`select public.username_available('ab')`), false);
  await as(alex);
  assert.equal(await scalar(`select public.username_available('alex')`), true, 'my own username is available to me');
  await as(sam);
  await expectError(q(`select public.update_profile(null, 'alex')`), 'taken');
  await expectError(q(`select public.update_profile(null, null, null, 'Mars/Phobos')`), 'Unknown time zone');
  const p = await scalar<Row>(`select public.update_profile('Sam O.', null, null, null)`);
  assert.equal(p.display_name, 'Sam O.');
  await q(`select public.update_profile('Sam Okafor')`);
});

console.log('\nfriends');
await test('request, auto-accept on cross request, accept, decline, unfriend, visibility', async () => {
  await as(alex);
  assert.equal(await scalar(`select public.send_friend_request('sam')`), 'outgoing');
  assert.equal(await scalar(`select public.send_friend_request('sam')`), 'outgoing');
  await expectError(q(`select public.send_friend_request('nobody')`), 'No one');
  await expectError(q(`select public.send_friend_request('alex')`), 'That is you');
  await as(sam);
  assert.equal(await scalar(`select public.send_friend_request('alex')`), 'friends', 'cross request accepts');
  const ev = await one(`select payload from public.feed_events where type = 'friends' and actor_id = $1`, [sam]);
  assert.equal(ev.payload.friend_id, alex);
  assert.equal(ev.payload.friend_name, 'Alex Chen');

  await as(alex);
  assert.equal(await scalar(`select public.send_friend_request('priya')`), 'outgoing');
  await as(priya);
  await q(`select public.accept_friend_request($1)`, [alex]);
  await expectError(q(`select public.accept_friend_request($1)`, [alex]), 'No request');

  // everybody else pairs up
  const pairs: [string, string, string, string][] = [
    [alex, jordan, 'jordan', 'alex'],
    [sam, priya, 'priya', 'sam'],
    [sam, jordan, 'jordan', 'sam'],
    [priya, jordan, 'jordan', 'priya'],
  ];
  for (const [a, b, bn, an] of pairs) {
    await as(a);
    await q(`select public.send_friend_request($1)`, [bn]);
    await as(b);
    assert.equal(await scalar(`select public.send_friend_request($1)`, [an]), 'friends');
  }
  await as(alex);
  assert.equal(await scalar(`select count(*)::int from public.visible_users()`), 4);

  // unfriend then re-add
  assert.equal(await scalar(`select public.remove_friend($1)`, [jordan]), true);
  assert.equal(await scalar(`select count(*)::int from public.visible_users()`), 3);
  await q(`select public.send_friend_request('jordan')`);
  await as(jordan);
  assert.equal(await scalar(`select public.send_friend_request('alex')`), 'friends');
  await as(alex);
  assert.equal(await scalar(`select count(*)::int from public.visible_users()`), 4);

  // incoming request from the outsider, declined
  await as(outsider);
  assert.equal(await scalar(`select public.send_friend_request('alex')`), 'outgoing');
  await as(alex);
  let s = await scalar<Row>(`select public.get_state()`);
  assert.equal(s.requests.incoming.length, 1);
  assert.equal(s.requests.incoming[0].username, 'outsider');
  await as(outsider);
  s = await scalar<Row>(`select public.get_state()`);
  assert.equal(s.requests.outgoing[0].username, 'alex');
  await as(alex);
  assert.equal(await scalar(`select public.remove_friend($1)`, [outsider]), true);
  s = await scalar<Row>(`select public.get_state()`);
  assert.equal(s.requests.incoming.length, 0);
  assert.equal(s.friends.length, 3);
  assert.equal(await scalar(`select count(*)::int from public.friendships where status = 'accepted'`), 6);
});

await test('search_users: prefix match, relation, excludes me, limit', async () => {
  await as(alex);
  const r = await scalar<Row[]>(`select public.search_users('sa')`);
  assert.equal(r.length, 1);
  assert.equal(r[0].username, 'sam');
  assert.equal(r[0].relation, 'friends');
  const r2 = await scalar<Row[]>(`select public.search_users('out')`);
  assert.equal(r2[0].relation, 'none');
  const r3 = await scalar<Row[]>(`select public.search_users('alex')`);
  assert.ok(r3.every((u: Row) => u.id !== alex));
  assert.equal((await scalar<Row[]>(`select public.search_users('')`)).length, 0);
});

console.log('\nschedule import + occurrences');
const sio = {
  ics_uid: 'sio-15122',
  course_code: '15-122',
  name: 'Imperative Computation',
  location_text: 'GHC 4401',
  tz: 'America/New_York',
  days_of_week: [1, 3, 5],
  start_time: '09:30',
  end_time: '10:20',
  term_start: '2026-08-24',
  term_end: '2026-12-11',
  exdates: ['2026-09-16'],
};
async function occOf(user: string, date: string, course = '15-122') {
  return await one(
    `select o.*, o.date::text as date_str from public.class_occurrences o join public.classes c on c.id = o.class_id
      where o.user_id = $1 and o.date = $2::date and c.course_code = $3 and not o.is_demo`,
    [user, date, course],
  );
}

await test('import_classes generates 7 days in each zone, honours exdates and windows', async () => {
  for (const u of [alex, sam, priya]) {
    await as(u);
    const r = await scalar<Row>(`select public.import_classes($1::jsonb)`, [JSON.stringify([sio])]);
    assert.deepEqual([r.inserted, r.updated, r.unchanged, r.class_count], [1, 0, 0, 1]);
  }
  await as(jordan);
  const rj = await scalar<Row>(`select public.import_classes($1::jsonb)`, [JSON.stringify([{ ...sio, tz: 'Europe/London', start_time: '15:30', end_time: '16:20' }])]);
  assert.equal(rj.inserted, 1);

  // Mon 14 and Fri 18 (Wed 16 is an exdate); today's slot still ahead of its deadline
  for (const u of [alex, sam, priya, jordan]) {
    assert.equal(await scalar(`select count(*)::int from public.class_occurrences where user_id = $1`, [u]), 2, 'Mon + Fri');
  }
  const a = await occOf(alex, MON);
  assert.equal(ms(a.starts_at), ms(`${MON}T13:30:00Z`), '09:30 New York');
  assert.equal(ms(a.opens_at), ms(a.starts_at) - 2 * 60_000);
  assert.equal(ms(a.on_time_until), ms(a.starts_at) + 10 * 60_000);
  assert.equal(ms(a.deadline), ms(a.ends_at) + 10 * 60_000);
  const j = await occOf(jordan, MON);
  assert.equal(ms(j.starts_at), ms(`${MON}T14:30:00Z`), '15:30 London');
  assert.equal(j.date_str, MON, 'local day in the class zone');
  await as(alex);
  assert.equal(await scalar(`select public.ensure_my_occurrences()`), 0, 'idempotent');
});

await test('re-import: unchanged is a no-op, a changed time regenerates, replace retires', async () => {
  await as(alex);
  const before = (await occOf(alex, MON)).id;
  let r = await scalar<Row>(`select public.import_classes($1::jsonb)`, [JSON.stringify([sio])]);
  assert.deepEqual([r.inserted, r.updated, r.unchanged], [0, 0, 1]);
  assert.equal((await occOf(alex, MON)).id, before, 'occurrences untouched');

  r = await scalar<Row>(`select public.import_classes($1::jsonb)`, [JSON.stringify([{ ...sio, start_time: '09:35' }])]);
  assert.equal(r.updated, 1);
  const moved = await occOf(alex, MON);
  assert.notEqual(moved.id, before, 'regenerated');
  assert.equal(ms(moved.starts_at), ms(`${MON}T13:35:00Z`));
  await q(`select public.import_classes($1::jsonb)`, [JSON.stringify([sio])]);
  assert.equal(ms((await occOf(alex, MON)).starts_at), ms(`${MON}T13:30:00Z`));

  // a manual row (no ics_uid) is inserted as manual
  r = await scalar<Row>(`select public.import_classes($1::jsonb)`, [JSON.stringify([{ ...sio, ics_uid: null, course_code: 'MANUAL' }])]);
  assert.equal(r.inserted, 1);
  assert.equal(await scalar(`select source from public.classes where user_id = $1 and course_code = 'MANUAL'`, [alex]), 'manual');
  await q(`delete from public.classes where user_id = $1 and course_code = 'MANUAL'`, [alex]);

  // replace: priya swaps 15-122 for 21-241, then swaps back
  await as(priya);
  r = await scalar<Row>(`select public.import_classes($1::jsonb, true)`, [
    JSON.stringify([{ ...sio, ics_uid: 'sio-21241', course_code: '21-241', days_of_week: [2, 4], start_time: '11:00', end_time: '11:50', exdates: [] }]),
  ]);
  assert.deepEqual([r.inserted, r.retired, r.class_count], [1, 1, 1]);
  assert.equal(await scalar(`select count(*)::int from public.class_occurrences o join public.classes c on c.id = o.class_id where o.user_id = $1 and c.course_code = '15-122' and o.status = 'pending'`, [priya]), 0, 'retired class loses its future occurrences');
  r = await scalar<Row>(`select public.import_classes($1::jsonb, true)`, [JSON.stringify([sio])]);
  assert.deepEqual([r.inserted, r.updated, r.retired], [0, 1, 1]);
  assert.equal(await scalar(`select count(*)::int from public.class_occurrences where user_id = $1 and status = 'pending'`, [priya]), 2, 'Mon + Fri are back');

  await expectError(q(`select public.import_classes($1::jsonb)`, [JSON.stringify([{ ...sio, course_code: '' }])]), 'course code');
  await expectError(q(`select public.import_classes($1::jsonb)`, [JSON.stringify([{ ...sio, days_of_week: [] }])]), 'no days');
  await expectError(q(`select public.import_classes($1::jsonb)`, [JSON.stringify([{ ...sio, end_time: '09:00' }])]), 'ends before');
});

console.log('\nthe window');
await test('create_post: not yet, on time (pins the room), double, late, wrong user, too late', async () => {
  const a = await occOf(alex, MON);
  await as(alex);
  await expectError(q(`select public.create_post($1, 'alex/x.jpg')`, [a.id]), 'Not yet');

  await setClock(`${MON}T13:29:00Z`); // 09:29, opens 09:28
  const r = await scalar<Row>(`select public.create_post($1, 'alex/x.jpg', 'alex/x-back.jpg', '  front row  ', 2, 40.4436, -79.9446, 20)`, [a.id]);
  assert.equal(r.late, false);
  assert.equal(r.location_verified, true, 'first on-time post pins the room and counts as nearby');
  assert.equal(r.streak_after, 1, 'Monday is complete');
  const cls = await one(`select lat, lng, radius_m from public.classes where user_id = $1`, [alex]);
  assert.equal(cls.radius_m, 40, 'max(40, 1.5 x 20)');
  const post = await one(`select * from public.posts where user_id = $1`, [alex]);
  assert.equal(post.caption, 'front row');
  assert.equal(post.retake_count, 2);
  assert.equal(ms(post.expires_at), ms(`${MON}T13:29:00Z`) + 24 * 3_600_000);
  const occ = await occOf(alex, MON);
  assert.equal(occ.status, 'posted');
  assert.equal(occ.late, false);
  const ev = await one(`select payload from public.feed_events where type = 'post' and actor_id = $1`, [alex]);
  assert.equal(ev.payload.username, 'alex');
  assert.equal(ev.payload.course_code, '15-122');
  assert.equal(ev.payload.location_text, 'GHC 4401');
  assert.equal(ev.payload.streak_after, 1);
  await expectError(q(`select public.create_post($1, 'alex/y.jpg')`, [a.id]), 'already posted');

  const s = await occOf(sam, MON);
  await as(sam);
  await setClock(`${MON}T13:41:00Z`); // 09:41 > on_time_until 09:40
  const rs = await scalar<Row>(`select public.create_post($1, 'sam/x.jpg')`, [s.id]);
  assert.equal(rs.late, true);
  assert.equal((await occOf(sam, MON)).late, true);
  assert.equal(await scalar(`select public.personal_streak($1)`, [sam]), 0, 'a late-only day neither extends nor breaks');

  await as(priya);
  await expectError(q(`select public.create_post($1, 'p.jpg')`, [s.id]), 'not your class');
  await expectError(q(`select public.create_post($1, '')`, [(await occOf(priya, MON)).id]), 'photo is required');

  await as(jordan);
  await setClock(`${MON}T14:29:00Z`); // 15:29 London
  const rj = await scalar<Row>(`select public.create_post($1, 'jordan/x.jpg')`, [(await occOf(jordan, MON)).id]);
  assert.equal(rj.late, false);
  assert.equal(rj.streak_after, 1);

  await as(priya);
  await setClock(`${MON}T14:31:00Z`); // 10:31 > deadline 10:30
  await expectError(q(`select public.create_post($1, 'p.jpg')`, [(await occOf(priya, MON)).id]), 'Too late');
});

let priyaMissId = '';
await test('detect_misses flips the pending row past its deadline once, with streak_before', async () => {
  assert.equal(await scalar(`select public.detect_misses()`), 1);
  assert.equal(await scalar(`select public.detect_misses()`), 0, 'idempotent');
  const occ = await occOf(priya, MON);
  assert.equal(occ.status, 'missed');
  const miss = await one(`select * from public.misses where user_id = $1`, [priya]);
  priyaMissId = miss.id;
  assert.equal(miss.excused, false);
  const ev = await one(`select payload from public.feed_events where type = 'miss' and actor_id = $1`, [priya]);
  assert.equal(ev.payload.streak_before, 0);
  assert.equal(ev.payload.username, 'priya');
  assert.equal(await scalar(`select public.personal_streak($1)`, [priya]), 0);
  await as(priya);
  const s = await scalar<Row>(`select public.get_state()`);
  assert.equal(s.my_unexplained_misses.length, 1);
  assert.equal(s.my_unexplained_misses[0].id, priyaMissId);
});

console.log('\nnearby + streaks');
await test('Friday: within the pin is nearby, outside is not, unpinned first on-time post pins', async () => {
  await setClock(`${FRI}T13:29:00Z`);
  await as(alex);
  let r = await scalar<Row>(`select public.create_post($1, 'alex/f.jpg', null, null, 0, 40.44365, -79.9446, 30)`, [(await occOf(alex, FRI)).id]);
  assert.equal(r.location_verified, true, '5 m from the pin');
  assert.equal(r.streak_after, 2);

  await q(`update public.classes set lat = 40.4436, lng = -79.9446, radius_m = 40 where user_id = $1`, [priya]);
  await as(priya);
  r = await scalar<Row>(`select public.create_post($1, 'priya/f.jpg', null, null, 0, 40.45, -79.95, 20)`, [(await occOf(priya, FRI)).id]);
  assert.equal(r.location_verified, false, '800 m away');
  assert.equal(r.late, false);

  await as(sam);
  r = await scalar<Row>(`select public.create_post($1, 'sam/f.jpg')`, [(await occOf(sam, FRI)).id]);
  assert.equal(r.location_verified, false, 'no fix, no badge');
  assert.equal(await scalar(`select lat from public.classes where user_id = $1`, [sam]), null, 'no fix, no pin');
});

await test('streaks: on-time days count, misses break, excuses restore; best_streak', async () => {
  assert.equal(await scalar(`select public.personal_streak($1)`, [alex]), 2);
  assert.equal(await scalar(`select public.best_streak($1)`, [alex]), 2);
  assert.equal(await scalar(`select public.personal_streak($1)`, [sam]), 1, 'Fri on time; Mon late-only ignored');
  assert.equal(await scalar(`select public.personal_streak($1)`, [priya]), 1, 'Fri complete, Mon missed');
  await as(priya);
  await q(`select public.excuse_miss($1)`, [priyaMissId]);
  assert.equal((await occOf(priya, MON)).status, 'excused');
  assert.equal(await scalar(`select public.personal_streak($1)`, [priya]), 2, 'excused Mon counts');
  const ev = await one(`select payload from public.feed_events where type = 'excused' and actor_id = $1`, [priya]);
  assert.equal(ev.payload.pre_emptive, false);
  await expectError(q(`select public.excuse_miss($1)`, [priyaMissId]), 'already excused');
  const s = await scalar<Row>(`select public.get_state()`);
  assert.equal(s.my_unexplained_misses.length, 0, 'an excused miss needs no explanation');
});

let jordanMissId = '';
await test('explanation becomes the first comment under the miss; only the misser can', async () => {
  await setClock(`${FRI}T15:31:00Z`); // Jordan's 15:30 London class: deadline 16:30 London = 15:30Z
  assert.equal(await scalar(`select public.detect_misses()`), 1);
  jordanMissId = (await one(`select id from public.misses where user_id = $1`, [jordan])).id;
  await as(alex);
  await expectError(q(`select public.explain_miss($1, 'nope')`, [jordanMissId]), 'Miss not found');
  await as(jordan);
  await expectError(q(`select public.explain_miss($1, '   ')`, [jordanMissId]), 'Say something');
  await q(`select public.explain_miss($1, 'overslept')`, [jordanMissId]);
  const missEv = await one(`select id from public.feed_events where type = 'miss' and ref_id = $1`, [jordanMissId]);
  const c = await one(`select * from public.comments where feed_event_id = $1`, [missEv.id]);
  assert.equal(c.user_id, jordan);
  assert.equal(c.text, 'overslept');
  assert.equal(await scalar(`select count(*)::int from public.feed_events where type = 'explanation'`), 0, 'no separate event');
  const s = await scalar<Row>(`select public.get_state()`);
  assert.equal(s.my_unexplained_misses.length, 0);
});

await test('pre-emptive excuse on a pending class', async () => {
  await as(alex);
  await q(`select public.import_classes($1::jsonb)`, [JSON.stringify([{ ...sio, ics_uid: 'sio-sat', course_code: '99-100', days_of_week: [6], start_time: '10:00', end_time: '10:50', exdates: [] }])]);
  const sat = await occOf(alex, '2026-09-19', '99-100');
  await expectError(q(`select public.excuse_occurrence($1, '  ')`, [sat.id]), 'Say why');
  await q(`select public.excuse_occurrence($1, 'dentist at 10')`, [sat.id]);
  assert.equal((await occOf(alex, '2026-09-19', '99-100')).status, 'excused');
  const m = await one(`select excused from public.misses where occurrence_id = $1`, [sat.id]);
  assert.equal(m.excused, true);
  const ev = await one(`select payload from public.feed_events where type = 'excused' and actor_id = $1`, [alex]);
  assert.equal(ev.payload.pre_emptive, true);
  assert.equal(ev.payload.reason, 'dentist at 10', 'the reason is announced');
  assert.equal((await one(`select explanation from public.misses where occurrence_id = $1`, [sat.id])).explanation, 'dentist at 10');
  await expectError(q(`select public.excuse_occurrence($1, 'again')`, [sat.id]), 'already excused');
  await as(sam);
  await expectError(q(`select public.excuse_occurrence($1, 'not mine')`, [sat.id]), 'not your class');
});

console.log('\nstate, reactions, comments');
await test('get_state: me, leaderboard order, friends today, feed, comments', async () => {
  await as(alex);
  const s = await scalar<Row>(`select public.get_state()`);
  assert.equal(s.me.username, 'alex');
  assert.equal(s.me.streak, 3, 'Mon, Fri on time + Sat excused');
  assert.equal(s.me.best_streak, 3);
  assert.equal(s.me.posted_today, true);
  assert.equal(s.me.has_class_today, true);
  assert.equal(s.me.class_count, 2);
  assert.equal(s.me.posts_count, 2);
  assert.equal(s.today, FRI);
  assert.deepEqual(
    s.friends.map((f: Row) => f.username),
    ['priya', 'sam', 'jordan'],
    'by streak desc (2, 1, 0)',
  );
  assert.equal(s.friends[0].posted_today, true);
  assert.equal(s.today_occurrences.filter((o: Row) => o.user_id !== alex).length, 3, "friends' Friday classes");
  const mine = s.today_occurrences.find((o: Row) => o.user_id === alex);
  assert.equal(mine.post.photo_path, 'alex/f.jpg');
  assert.equal(mine.location_text, 'GHC 4401');
  assert.equal(s.feed[0].type, 'excused');
  assert.ok(s.feed.some((e: Row) => e.type === 'friends'));
  assert.equal(s.comments.length, 1, "jordan's explanation");
  assert.equal(s.comments[0].username, 'jordan');
  await as(outsider);
  const o = await scalar<Row>(`select public.get_state()`);
  assert.equal(o.friends.length, 0);
  assert.equal(o.feed.length, 0);
  assert.equal(o.me.class_count, 0);
});

await test('reactions toggle; comments post; outsiders are refused', async () => {
  const ev = await one(`select id from public.feed_events where type = 'post' and actor_id = $1 order by created_at desc limit 1`, [alex]);
  await as(sam);
  assert.equal(await scalar(`select public.toggle_reaction($1, '🔥')`, [ev.id]), true);
  assert.equal(await scalar(`select public.toggle_reaction($1, '🔥')`, [ev.id]), false);
  await expectError(q(`select public.toggle_reaction($1, '')`, [ev.id]), 'Bad emoji');
  await as(outsider);
  await expectError(q(`select public.toggle_reaction($1, '🔥')`, [ev.id]), 'cannot see');
  await expectError(q(`select public.add_comment($1, 'hi')`, [ev.id]), 'cannot see');
  await as(priya);
  const c = await scalar<Row>(`select public.add_comment($1, '  nice  ')`, [ev.id]);
  assert.equal(c.text, 'nice');
  assert.equal(c.username, 'priya');
  await expectError(q(`select public.add_comment($1, ' ')`, [ev.id]), 'Say something');
  await as(alex);
  const s = await scalar<Row>(`select public.get_state()`);
  assert.equal(s.comments.filter((x: Row) => x.feed_event_id === ev.id).length, 1);
});

await test('memories and photo expiry', async () => {
  await as(alex);
  assert.equal((await scalar<Row[]>(`select public.get_memories()`)).length, 2);
  await setClock('2026-10-20T13:00:00Z');
  const n = await scalar<number>(`select public.expire_photos()`);
  assert.ok(n >= 5, `expired ${n}`);
  assert.equal(await scalar(`select count(*)::int from public.posts where photo_path is not null`), 0);
  assert.equal((await scalar<Row[]>(`select public.get_memories()`)).length, 0);
  await setClock(`${FRI}T17:00:00Z`);
});

console.log('\ndemo controls');
async function demoOcc(u: string) {
  return (await one(`select id from public.class_occurrences where is_demo and user_id = $1`, [u])).id as string;
}
await test('start class now -> on time, late, replay, miss, explanation, reset', async () => {
  await as(alex);
  assert.equal(await scalar(`select public.dev_start_class_now('15-122', 2, 2)`), 4);
  await expectError(q(`select public.dev_start_class_now('99-999')`), 'Nobody has');
  assert.equal(await scalar(`select count(*)::int from public.class_occurrences where is_demo`), 4);

  await as(sam);
  let r = await scalar<Row>(`select public.create_post($1, 'sam/d.jpg')`, [await demoOcc(sam)]);
  assert.equal(r.late, false);

  await as(alex);
  assert.equal(await scalar(`select public.dev_end_on_time_now()`), 3);
  await as(priya);
  r = await scalar<Row>(`select public.create_post($1, 'priya/d.jpg')`, [await demoOcc(priya)]);
  assert.equal(r.late, true);

  await as(alex);
  r = await scalar<Row>(`select public.dev_replay_post($1)`, [jordan]);
  assert.equal(r.late, true);
  assert.equal(await scalar(`select photo_path from public.posts where occurrence_id = $1`, [await demoOcc(jordan)]), `seed/${jordan}/1.jpg`);
  await expectError(q(`select public.dev_replay_post($1)`, [outsider]), 'not a friend');

  assert.equal(await scalar(`select public.dev_end_window_now()`), 1, 'Alex never posted');
  assert.equal(await scalar(`select status::text from public.class_occurrences where id = $1`, [await demoOcc(alex)]), 'missed');
  const ev = await one(`select payload from public.feed_events where type = 'miss' and actor_id = $1 order by created_at desc limit 1`, [alex]);
  assert.equal(ev.payload.streak_before, 2);
  await q(`select public.dev_replay_explanation('phone died')`);
  const missEv = await one(`select id from public.feed_events where type = 'miss' and actor_id = $1 order by created_at desc limit 1`, [alex]);
  assert.equal(await scalar(`select text from public.comments where feed_event_id = $1`, [missEv.id]), 'phone died');

  await q(`select public.dev_reset_demo()`);
  assert.equal(await scalar(`select count(*)::int from public.class_occurrences where is_demo`), 0);
  assert.equal(await scalar(`select count(*)::int from public.posts where photo_path like '%/d.jpg'`), 0);
  assert.equal(await scalar(`select count(*)::int from public.feed_events where occurrence_id is not null and occurrence_id not in (select id from public.class_occurrences)`), 0);
  assert.equal(await scalar(`select public.personal_streak($1)`, [alex]), 3, 'history intact');
});

console.log('\nrow level security');
await test('outsider sees nothing; friends see each other; nobody writes feed, posts or friendships', async () => {
  const visibleClasses = await scalar<number>(`select count(*)::int from public.classes where user_id in ($1, $2, $3, $4)`, [alex, sam, priya, jordan]);
  await q(`set role authenticated`);
  try {
    await as(outsider);
    assert.equal(await scalar(`select count(*)::int from public.feed_events`), 0);
    assert.equal(await scalar(`select count(*)::int from public.posts`), 0);
    assert.equal(await scalar(`select count(*)::int from public.class_occurrences`), 0);
    assert.equal(await scalar(`select count(*)::int from public.classes`), 0);
    assert.equal(await scalar(`select count(*)::int from public.comments`), 0);
    assert.ok((await scalar<number>(`select count(*)::int from public.profiles`)) >= 6, 'profiles are searchable');
    await as(sam);
    assert.ok((await scalar<number>(`select count(*)::int from public.feed_events`)) > 0);
    assert.equal(await scalar(`select count(*)::int from public.classes`), visibleClasses, "friends' classes");
    assert.equal(await scalar(`select count(*)::int from public.friendships`), 3, 'my own edges only');
    await expectError(q(`insert into public.feed_events (actor_id, type) values ($1, 'friends')`, [sam]), 'row-level security');
    await expectError(q(`insert into public.posts (occurrence_id, user_id, expires_at, memory_until) values (gen_random_uuid(), $1, now(), now())`, [sam]), 'row-level security');
    await expectError(q(`insert into public.friendships (user_lo, user_hi, requested_by) values ($1, $2, $1)`, [sam < outsider ? sam : outsider, sam < outsider ? outsider : sam]), 'row-level security');
    await q(`update public.profiles set display_name = 'hacked' where id = $1`, [alex]);
    assert.notEqual(await scalar(`select display_name from public.profiles where id = $1`, [alex]), 'hacked', 'update on another profile affects nothing');
    const s = await scalar<Row>(`select public.get_state()`);
    assert.equal(s.me.username, 'sam');
    assert.equal(s.friends.length, 3);
  } finally {
    await q(`reset role`);
    await q(`update public.profiles set display_name = 'Alex Chen' where id = $1`, [alex]);
  }
});

console.log(`\n${passed} tests passed`);
await db.close();
