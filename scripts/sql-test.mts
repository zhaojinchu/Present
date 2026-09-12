/* eslint-disable no-console */
// Runs the migrations in an in-process Postgres (PGlite) with a stub `auth` schema and
// exercises the whole skip moment: check-ins, skip detection, forfeits, streaks, excuses,
// the daily cap, and RLS. No Supabase project needed.  `npm run sql:test`
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
async function expectError(p: Promise<unknown>, contains: string) {
  try {
    await p;
  } catch (e: any) {
    assert.ok(String(e.message).includes(contains), `expected error containing "${contains}", got: ${e.message}`);
    return;
  }
  assert.fail(`expected an error containing "${contains}"`);
}

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

// ---------------------------------------------------------------- fixtures

const names = ['Alex', 'Sam', 'Priya', 'Jordan', 'Outsider'];
const ids: Record<string, string> = {};
for (const n of names) {
  const row = await one<{ id: string }>(
    `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
    [`${n.toLowerCase()}@present.demo`, JSON.stringify({ display_name: n })],
  );
  ids[n] = row.id;
}
const [alex, sam, priya, jordan, outsider] = names.map((n) => ids[n]);

await q(`insert into public.buildings (code, name, lat, lng, radius_m) values
  ('GHC', 'Gates & Hillman Centers', 40.4436, -79.9446, 110),
  ('WEH', 'Wean Hall', 40.4427, -79.9457, 100)`);

console.log('\nprofiles + circles');
await test('auth.users insert creates profiles with display_name', async () => {
  const n = await scalar<number>(`select count(*)::int from public.profiles`);
  assert.equal(n, 5);
  const p = await one(`select display_name from public.profiles where id = $1`, [alex]);
  assert.equal(p.display_name, 'Alex');
});

let circleId = '';
let inviteCode = '';
await test('create_circle returns a 6-char code and posts member_joined', async () => {
  await as(alex);
  const c = await scalar<Row>(`select public.create_circle('Hack House', 'buys the circle boba')`);
  circleId = c.id;
  inviteCode = c.invite_code;
  assert.match(inviteCode, /^[A-Z2-9]{6}$/);
  assert.equal(await scalar(`select public.my_circle_id()`), circleId);
  await expectError(q(`select public.create_circle('Again', 'x')`), 'already in a circle');
});

await test('join_circle by code; bad code and second circle are rejected', async () => {
  for (const u of [sam, priya, jordan]) {
    await as(u);
    const c = await scalar<Row>(`select public.join_circle($1)`, [inviteCode.toLowerCase()]);
    assert.equal(c.id, circleId);
  }
  await as(outsider);
  await expectError(q(`select public.join_circle('ZZZZZZ')`), 'No circle with that code');
  await as(sam);
  await expectError(q(`select public.join_circle($1)`, [inviteCode]), 'already in a circle');
  const n = await scalar<number>(`select count(*)::int from public.circle_members where circle_id = $1`, [circleId]);
  assert.equal(n, 4);
});

console.log('\nschedule + occurrence generation');
await test('class insert trigger generates the next 7 days, skipping already-missed slots', async () => {
  // Every day of the week, at 03:00-03:50 local: today's slot is long gone -> must not be created.
  for (const u of [alex, sam, priya, jordan]) {
    await as(u);
    await q(
      `insert into public.classes (user_id, course_code, name, building_code, days_of_week, start_time, end_time)
       values ($1, '15-122', 'Imperative Computation', 'GHC', '{0,1,2,3,4,5,6}', '03:00', '03:50')`,
      [u],
    );
  }
  const today = await scalar<string>(`select public.ny_today()::text`);
  const todays = await scalar<number>(`select count(*)::int from public.class_occurrences where date = $1::date`, [today]);
  assert.equal(todays, 0, 'a 3am class added later in the day must not create an instant skip');
  const total = await scalar<number>(`select count(*)::int from public.class_occurrences`);
  assert.equal(total, 4 * 6, 'six future days per person');
  const occ = await one(
    `select starts_at, window_start, window_end, ends_at, skip_deadline from public.class_occurrences order by starts_at limit 1`,
  );
  const s = new Date(occ.starts_at).getTime();
  assert.equal(new Date(occ.window_start).getTime(), s - 10 * 60_000);
  assert.equal(new Date(occ.window_end).getTime(), s + 15 * 60_000);
  assert.equal(new Date(occ.skip_deadline).getTime(), new Date(occ.ends_at).getTime() + 10 * 60_000);
});

await test('ensure_occurrences is idempotent', async () => {
  const tomorrow = await scalar<string>(`select (public.ny_today() + 1)::text`);
  const n = await scalar<number>(`select public.ensure_occurrences($1::date, 1)`, [tomorrow]);
  assert.equal(n, 0);
});

// Seed 3 days of clean history for all 4 members so streaks are non-trivial.
for (const u of [alex, sam, priya, jordan]) {
  const cls = await one(`select id from public.classes where user_id = $1`, [u]);
  for (let d = 3; d >= 1; d--) {
    await q(
      `insert into public.class_occurrences
         (class_id, user_id, building_code, date, starts_at, ends_at, window_start, window_end, skip_deadline, status)
       select $1, $2, 'GHC', (public.ny_today() - $3::int),
              s, s + interval '50 min', s - interval '10 min', s + interval '15 min', s + interval '60 min', 'checked_in'
       from (select ((public.ny_today() - $3::int) + time '09:30') at time zone 'America/New_York' as s) t`,
      [cls.id, u, d],
    );
  }
}

// Members joined just now, and the circle streak ignores history from before you joined
// (by design), so back-date the memberships the way the seed script does.
await q(`update public.circle_members set joined_at = now() - interval '30 days'`);

console.log('\nstreaks');
await test('3 clean days -> personal 3, circle 3; today undecided', async () => {
  assert.equal(await scalar(`select public.personal_streak($1)`, [alex]), 3);
  assert.equal(await scalar(`select public.circle_streak($1)`, [circleId]), 3);
});

console.log('\nthe skip moment');
await test('dev_start_class_now creates one demo occurrence per member', async () => {
  await as(alex);
  const n = await scalar<number>(`select public.dev_start_class_now('15-122', 3, 3)`);
  assert.equal(n, 4);
  await expectError(q(`select public.dev_start_class_now('99-999')`), 'Nobody in your circle');
  // demo table still fine after the failed call? (exception rolled that statement back)
  assert.equal(await scalar(`select count(*)::int from public.class_occurrences where is_demo`), 4);
});

async function demoOcc(u: string) {
  return (await one(`select id from public.class_occurrences where is_demo and user_id = $1`, [u])).id as string;
}

await test('check-in flips status, posts a checkin event with streak_after', async () => {
  for (const u of [alex, sam, priya]) {
    await as(u);
    await q(`insert into public.checkins (occurrence_id, user_id, photo_path, in_geofence) values ($1, $2, $3, true)`, [
      await demoOcc(u),
      u,
      `${u}/x.jpg`,
    ]);
  }
  const st = await scalar<string>(`select status::text from public.class_occurrences where id = $1`, [await demoOcc(alex)]);
  assert.equal(st, 'checked_in');
  const ev = await one(`select payload from public.feed_events where type = 'checkin' and actor_id = $1`, [alex]);
  assert.equal(ev.payload.course_code, '15-122');
  assert.equal(ev.payload.personal_streak_after, 4, 'today is now complete for Alex');
  assert.equal(ev.payload.display_name, 'Alex');
});

await test('check-in guards: wrong user, double check-in', async () => {
  await as(sam);
  await expectError(
    q(`insert into public.checkins (occurrence_id, user_id) values ($1, $2)`, [await demoOcc(jordan), sam]),
    'not your class',
  );
  await as(alex);
  await expectError(
    q(`insert into public.checkins (occurrence_id, user_id) values ($1, $2)`, [await demoOcc(alex), alex]),
    'already checked in',
  );
});

await test('dev_end_window_now -> Jordan skipped, forfeit owed, streaks die, snapshots kept', async () => {
  await as(alex);
  const n = await scalar<number>(`select public.dev_end_window_now()`);
  assert.equal(n, 1);
  const st = await scalar<string>(`select status::text from public.class_occurrences where id = $1`, [await demoOcc(jordan)]);
  assert.equal(st, 'skipped');
  const skip = await one(`select * from public.skips where user_id = $1`, [jordan]);
  assert.equal(skip.excused, false);
  const f = await one(`select * from public.forfeits where owed_by = $1`, [jordan]);
  assert.equal(f.status, 'owed');
  assert.equal(f.description, 'buys the circle boba');
  const ev = await one(`select payload from public.feed_events where type = 'skip' and actor_id = $1`, [jordan]);
  assert.equal(ev.payload.circle_streak_before, 3);
  assert.equal(ev.payload.personal_streak_before, 3);
  assert.equal(await scalar(`select count(*)::int from public.feed_events where type = 'forfeit_owed'`), 1);
  assert.equal(await scalar(`select public.circle_streak($1)`, [circleId]), 0);
  assert.equal(await scalar(`select public.personal_streak($1)`, [jordan]), 0);
  assert.equal(await scalar(`select public.personal_streak($1)`, [alex]), 4);
  // idempotent: running detection again does nothing
  assert.equal(await scalar(`select public.detect_skips()`), 0);
});

await test('check-in after the window closed is rejected', async () => {
  await as(jordan);
  await expectError(
    q(`insert into public.checkins (occurrence_id, user_id) values ($1, $2)`, [await demoOcc(jordan), jordan]),
    'already skipped',
  );
});

await test('get_circle_state shows my_unexplained_skips for Jordan only', async () => {
  await as(jordan);
  const s = await scalar<Row>(`select public.get_circle_state()`);
  assert.equal(s.my_unexplained_skips.length, 1);
  assert.equal(s.my_unexplained_skips[0].course_code, '15-122');
  assert.equal(s.circle_streak, 0);
  assert.equal(s.members.length, 4);
  assert.equal(s.today.filter((o: Row) => o.is_demo).length, 4);
  assert.equal(s.forfeits.length, 1);
  assert.equal(s.forfeits[0].owed_by_name, 'Jordan');
  assert.equal(s.my_class_count, 1);
  await as(alex);
  const s2 = await scalar<Row>(`select public.get_circle_state()`);
  assert.equal(s2.my_unexplained_skips.length, 0);
  assert.ok(s2.feed.length >= 6);
  assert.equal(s2.feed[0].type, 'forfeit_owed');
});

await test('explain_skip posts an explanation event; only the skipper can', async () => {
  const skip = await one(`select id from public.skips where user_id = $1`, [jordan]);
  await as(alex);
  await expectError(q(`select public.explain_skip($1, 'nope')`, [skip.id]), 'Skip not found');
  await as(jordan);
  await expectError(q(`select public.explain_skip($1, '   ')`, [skip.id]), 'Say something');
  await q(`select public.explain_skip($1, 'slept in')`, [skip.id]);
  const ev = await one(`select payload from public.feed_events where type = 'explanation'`);
  assert.equal(ev.payload.text, 'slept in');
  await as(jordan);
  const s = await scalar<Row>(`select public.get_circle_state()`);
  assert.equal(s.my_unexplained_skips.length, 0);
});

await test('mark_forfeit_paid: not by the owner, only once, posts forfeit_paid', async () => {
  const f = await one(`select id from public.forfeits where owed_by = $1`, [jordan]);
  await as(jordan);
  await expectError(q(`select public.mark_forfeit_paid($1)`, [f.id]), "can't clear your own");
  await as(outsider);
  await expectError(q(`select public.mark_forfeit_paid($1)`, [f.id]), 'not your circle');
  await as(sam);
  await q(`select public.mark_forfeit_paid($1)`, [f.id]);
  const row = await one(`select status, marked_paid_by from public.forfeits where id = $1`, [f.id]);
  assert.equal(row.status, 'paid');
  assert.equal(row.marked_paid_by, sam);
  const ev = await one(`select payload from public.feed_events where type = 'forfeit_paid'`);
  assert.equal(ev.payload.paid_by_name, 'Sam');
  assert.equal(ev.payload.display_name, 'Jordan');
  await expectError(q(`select public.mark_forfeit_paid($1)`, [f.id]), 'already paid');
});

await test('reactions toggle on and off', async () => {
  const ev = await one(`select id from public.feed_events where type = 'skip'`);
  await as(sam);
  assert.equal(await scalar(`select public.toggle_reaction($1, '💀')`, [ev.id]), true);
  assert.equal(await scalar(`select public.toggle_reaction($1, '💀')`, [ev.id]), false);
  await as(outsider);
  await expectError(q(`select public.toggle_reaction($1, '🔥')`, [ev.id]), 'not your circle');
});

console.log('\nexcuses');
await test('after-the-fact excuse voids the forfeit and restores the streaks', async () => {
  await as(alex);
  await q(`select public.dev_start_class_now('15-122', 3, 3)`); // resets the previous demo
  for (const u of [alex, sam, priya]) {
    await as(u);
    await q(`insert into public.checkins (occurrence_id, user_id) values ($1, $2)`, [await demoOcc(u), u]);
  }
  await as(alex);
  assert.equal(await scalar(`select public.dev_end_window_now()`), 1);
  assert.equal(await scalar(`select public.circle_streak($1)`, [circleId]), 0);
  const skip = await one(`select id from public.skips where user_id = $1`, [jordan]);
  await as(jordan);
  await q(`select public.excuse_skip($1)`, [skip.id]);
  assert.equal(await scalar(`select status::text from public.class_occurrences where id = $1`, [await demoOcc(jordan)]), 'excused');
  assert.equal(await scalar(`select status::text from public.forfeits where skip_id = $1`, [skip.id]), 'voided');
  assert.equal(await scalar(`select public.circle_streak($1)`, [circleId]), 4, 'today complete for everyone again');
  assert.equal(await scalar(`select public.personal_streak($1)`, [jordan]), 4);
  const ev = await one(`select payload from public.feed_events where type = 'excused'`);
  assert.equal(ev.payload.pre_emptive, false);
  await expectError(q(`select public.excuse_skip($1)`, [skip.id]), 'already excused');
});

await test('pre-emptive excuse from Home: no forfeit, streak intact, visible in feed', async () => {
  await as(alex);
  await q(`select public.dev_start_class_now('15-122', 3, 3)`);
  await as(jordan);
  await q(`select public.excuse_occurrence($1)`, [await demoOcc(jordan)]);
  for (const u of [alex, sam, priya]) {
    await as(u);
    await q(`insert into public.checkins (occurrence_id, user_id) values ($1, $2)`, [await demoOcc(u), u]);
  }
  await as(alex);
  assert.equal(await scalar(`select public.dev_end_window_now()`), 0);
  assert.equal(await scalar(`select count(*)::int from public.forfeits where owed_by = $1 and status <> 'voided'`, [jordan]), 0);
  assert.equal(await scalar(`select public.circle_streak($1)`, [circleId]), 4);
  const ev = await one(`select payload from public.feed_events where type = 'excused' and (payload->>'pre_emptive')::boolean`);
  assert.equal(ev.payload.display_name, 'Jordan');
  await as(jordan);
  await expectError(q(`select public.excuse_occurrence($1)`, [await demoOcc(jordan)]), 'already excused');
});

console.log('\ncaps and batches');
await test('one forfeit per person per day, even with two skips', async () => {
  await as(alex);
  await q(`select public.dev_start_class_now('15-122', 3, 3)`);
  await q(`select public.dev_end_window_now()`); // everyone skips: 4 skips, 4 forfeits
  assert.equal(await scalar(`select count(*)::int from public.forfeits where status = 'owed'`), 4);
  // a second, already-missed demo occurrence for Jordan today
  const cls = await one(`select id from public.classes where user_id = $1`, [jordan]);
  await q(
    `insert into public.class_occurrences
       (class_id, user_id, building_code, date, starts_at, ends_at, window_start, window_end, skip_deadline, is_demo)
     values ($1, $2, 'GHC', public.ny_today(), now() - interval '2 hour', now() - interval '70 min',
             now() - interval '130 min', now() - interval '105 min', now() - interval '60 min', true)`,
    [cls.id, jordan],
  );
  assert.equal(await scalar(`select public.detect_skips()`), 1);
  assert.equal(await scalar(`select count(*)::int from public.skips where user_id = $1`, [jordan]), 2);
  assert.equal(await scalar(`select count(*)::int from public.forfeits where owed_by = $1 and status = 'owed'`, [jordan]), 1);
});

await test('two members skipped in one batch both see the same circle_streak_before', async () => {
  const rows = await q(
    `select payload->>'circle_streak_before' as before from public.feed_events
      where type = 'skip' and occurrence_id in (select id from public.class_occurrences where is_demo)
      order by created_at`,
  );
  assert.ok(rows.length >= 4);
  const firstFour = rows.slice(0, 4).map((r) => r.before);
  assert.deepEqual(firstFour, ['3', '3', '3', '3'], 'demo reset made today undecided again; history is 3 days');
});

await test('dev_reset_demo cascades checkins, skips, forfeits and feed events', async () => {
  await as(alex);
  await q(`select public.dev_reset_demo()`);
  assert.equal(await scalar(`select count(*)::int from public.class_occurrences where is_demo`), 0);
  assert.equal(await scalar(`select count(*)::int from public.skips`), 0);
  assert.equal(await scalar(`select count(*)::int from public.forfeits`), 0);
  assert.equal(await scalar(`select count(*)::int from public.feed_events where type <> 'member_joined'`), 0);
  assert.equal(await scalar(`select public.circle_streak($1)`, [circleId]), 3, 'history intact');
});

console.log('\nreplay helpers');
await test('replay checkin / explanation / pay forfeit drive the whole moment server-side', async () => {
  await as(alex);
  await q(`select public.dev_start_class_now('15-122', 3, 3)`);
  await q(`select public.dev_replay_checkin($1)`, [sam]);
  await q(`select public.dev_replay_checkin($1)`, [priya]);
  await q(`insert into public.checkins (occurrence_id, user_id) values ($1, $2)`, [await demoOcc(alex), alex]);
  const c = await one(`select photo_path from public.checkins where user_id = $1`, [sam]);
  assert.equal(c.photo_path, `seed/${sam}/1.jpg`);
  assert.equal(await scalar(`select public.dev_end_window_now()`), 1);
  await q(`select public.dev_replay_explanation('phone died')`);
  assert.equal(await scalar(`select explanation from public.skips where user_id = $1`, [jordan]), 'phone died');
  await q(`select public.dev_replay_pay_forfeit()`);
  const f = await one(`select status, marked_paid_by from public.forfeits where owed_by = $1`, [jordan]);
  assert.equal(f.status, 'paid');
  assert.notEqual(f.marked_paid_by, jordan);
});

console.log('\nrow level security');
await test('outsider sees nothing; members see their circle; nobody can insert feed events', async () => {
  await q(`set role authenticated`);
  try {
    await as(outsider);
    assert.equal(await scalar(`select count(*)::int from public.feed_events`), 0);
    assert.equal(await scalar(`select count(*)::int from public.circles`), 0);
    assert.equal(await scalar(`select count(*)::int from public.class_occurrences`), 0);
    await as(sam);
    assert.ok((await scalar<number>(`select count(*)::int from public.feed_events`)) > 0);
    assert.equal(await scalar(`select count(*)::int from public.circles`), 1);
    assert.equal(await scalar(`select count(*)::int from public.classes`), 4, 'sees circle-mates classes');
    await expectError(
      q(`insert into public.feed_events (circle_id, actor_id, type) values ($1, $2, 'member_joined')`, [circleId, sam]),
      'row-level security',
    );
    await expectError(
      q(`update public.forfeits set status = 'paid'`),
      'row-level security',
    ).catch(async () => {
      // an UPDATE with no matching policy silently affects 0 rows on some versions; verify nothing changed
      const n = await scalar<number>(`select count(*)::int from public.forfeits where status = 'paid' and marked_paid_by is null`);
      assert.equal(n, 0);
    });
    // RPCs still work through security definer
    const s = await scalar<Row>(`select public.get_circle_state()`);
    assert.equal(s.circle.id, circleId);
  } finally {
    await q(`reset role`);
  }
});

console.log(`\n${passed} tests passed`);
await db.close();
