/* eslint-disable no-console */
// Present — demo seed. Wipes and rebuilds the team's accounts, circle, schedules and two weeks
// of believable history (PLAN.md §9). Idempotent: run it as often as you like.
//
//   npm run seed
//
// Needs in .env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL (session pooler URI).
// Input: scripts/seed/schedules.json (falls back to schedules.example.json).
// Photos: scripts/seed/photos/<first>-<n>.jpg (optional; any *.jpg is used as a fallback).
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
const TZ = 'America/New_York';
const BUCKET = 'checkin-photos';

// ---------------------------------------------------------------- config

interface ClassSpec {
  course_code: string;
  name?: string;
  building_code: string;
  days: number[];
  start: string; // 'HH:MM'
  end: string;
}
interface MemberSpec {
  first: string;
  display_name: string;
  classes: ClassSpec[];
}
interface SeedSpec {
  circle: { name: string; forfeit_text: string; invite_code: string };
  password: string;
  demo_course: string;
  past_skip_member: string;
  past_skip_paid_by: string;
  history_class_days: number;
  members: MemberSpec[];
}

const env = (k: string) => {
  const v = process.env[k];
  if (!v) {
    console.error(`Missing ${k} in .env (see .env.example)`);
    process.exit(1);
  }
  return v;
};
const SUPABASE_URL = env('SUPABASE_URL');
const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY');
const DATABASE_URL = env('DATABASE_URL');

const specPath = fs.existsSync(path.join(here, 'seed', 'schedules.json'))
  ? path.join(here, 'seed', 'schedules.json')
  : path.join(here, 'seed', 'schedules.example.json');
if (specPath.endsWith('example.json')) console.warn('! scripts/seed/schedules.json not found, using the example schedules');
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8')) as SeedSpec;
for (const m of spec.members) {
  if (!m.classes.some((c) => c.course_code === spec.demo_course)) {
    console.error(`${m.display_name} has no ${spec.demo_course}; every member needs the demo course (dev "start class now" targets it)`);
    process.exit(1);
  }
}

const BUILDINGS: [string, string, number, number, number][] = [
  ['GHC', 'Gates & Hillman Centers', 40.4436, -79.9446, 110],
  ['WEH', 'Wean Hall', 40.4427, -79.9457, 100],
  ['DH', 'Doherty Hall', 40.4423, -79.9446, 100],
  ['BH', 'Baker Hall', 40.4415, -79.9444, 100],
  ['PH', 'Porter Hall', 40.4416, -79.9455, 100],
  ['HH', 'Hamerschlag Hall', 40.4424, -79.9466, 90],
  ['SH', 'Scaife Hall', 40.4422, -79.9472, 90],
  ['HL', 'Hunt Library', 40.4409, -79.9437, 90],
  ['CUC', 'Cohon University Center', 40.4431, -79.942, 110],
  ['TEP', 'Tepper Quad', 40.445, -79.9456, 110],
  ['POS', 'Posner Hall', 40.4411, -79.9422, 80],
  ['MM', 'Margaret Morrison Carnegie Hall', 40.4404, -79.9426, 90],
  ['NSH', 'Newell-Simon Hall', 40.4435, -79.9455, 90],
  ['MI', 'Mellon Institute', 40.4457, -79.9512, 100],
];

// ---------------------------------------------------------------- helpers

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const db = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function sql<T = Record<string, any>>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query(text, params)).rows as T[];
}

/** 'YYYY-MM-DD' of a Date in New York. */
function nyDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
/** Day of week (0=Sun) of a 'YYYY-MM-DD' date, treating it as a calendar date. */
function dow(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
const rand = (n: number) => Math.floor(Math.random() * n);
function shuffle<T>(a: T[]): T[] {
  return [...a].sort(() => Math.random() - 0.5);
}

/** Build a timestamptz expression for a local NY date + time, resolved by Postgres. */
const at = (ymd: string, hhmm: string) => `(('${ymd} ${hhmm}')::timestamp at time zone '${TZ}')`;

// ---------------------------------------------------------------- main

await db.connect();
const today = (await sql<{ d: string }>(`select (now() at time zone '${TZ}')::date::text as d`))[0].d;
console.log(`Seeding against ${SUPABASE_URL} (today in NY: ${today})`);

// 1. Wipe previous seed users (cascades profiles -> classes, occurrences, checkins, feed, memberships).
{
  let page = 1;
  let deleted = 0;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    for (const u of data.users) {
      if (u.email?.endsWith('@present.demo')) {
        const { error: e } = await admin.auth.admin.deleteUser(u.id);
        if (e) throw e;
        deleted += 1;
      }
    }
    if (data.users.length < 200) break;
    page += 1;
  }
  await sql(`delete from public.circles where invite_code = $1`, [spec.circle.invite_code]);
  console.log(`wiped ${deleted} seed users`);
}

// 2. Buildings.
for (const [code, name, lat, lng, r] of BUILDINGS) {
  await sql(
    `insert into public.buildings (code, name, lat, lng, radius_m) values ($1, $2, $3, $4, $5)
     on conflict (code) do update set name = excluded.name, lat = excluded.lat, lng = excluded.lng, radius_m = excluded.radius_m`,
    [code, name, lat, lng, r],
  );
}
console.log(`upserted ${BUILDINGS.length} buildings`);

// 3. Users.
const userId: Record<string, string> = {};
for (const m of spec.members) {
  const { data, error } = await admin.auth.admin.createUser({
    email: `${m.first}@present.demo`,
    password: spec.password,
    email_confirm: true,
    user_metadata: { display_name: m.display_name },
  });
  if (error) throw error;
  userId[m.first] = data.user.id;
}
console.log(`created ${spec.members.length} users`);

// 4. Photos: upload scripts/seed/photos/*.jpg as seed/<user_id>/<n>.jpg.
const photoDir = path.join(here, 'seed', 'photos');
const allPhotos = fs.existsSync(photoDir) ? fs.readdirSync(photoDir).filter((f) => /\.(jpe?g|png)$/i.test(f)) : [];
const photoPaths: Record<string, string[]> = {};
for (const m of spec.members) {
  const mine = allPhotos.filter((f) => f.toLowerCase().startsWith(`${m.first}-`));
  const files = mine.length ? mine : shuffle(allPhotos).slice(0, 4);
  photoPaths[m.first] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const dest = `seed/${userId[m.first]}/${i + 1}.jpg`;
    const { error } = await admin.storage
      .from(BUCKET)
      .upload(dest, fs.readFileSync(path.join(photoDir, f)), { contentType: /png$/i.test(f) ? 'image/png' : 'image/jpeg', upsert: true });
    if (error) throw new Error(`upload ${dest}: ${error.message}`);
    photoPaths[m.first].push(dest);
  }
}
if (!allPhotos.length) console.warn('! no photos in scripts/seed/photos; history cards will have no images');
else console.log(`uploaded ${Object.values(photoPaths).flat().length} photos`);

// 5. Circle + members (joined three weeks ago, so history counts toward the circle streak).
const circleId = (
  await sql<{ id: string }>(
    `insert into public.circles (name, forfeit_text, invite_code, created_by) values ($1, $2, $3, $4) returning id`,
    [spec.circle.name, spec.circle.forfeit_text, spec.circle.invite_code, userId[spec.members[0].first]],
  )
)[0].id;
for (const [i, m] of spec.members.entries()) {
  await sql(`insert into public.circle_members (circle_id, user_id, joined_at) values ($1, $2, now() - interval '21 days')`, [circleId, userId[m.first]]);
  await sql(
    `insert into public.feed_events (circle_id, actor_id, type, payload, created_at)
     values ($1, $2, 'member_joined', $3, now() - interval '21 days' + ($4 || ' minutes')::interval)`,
    [circleId, userId[m.first], JSON.stringify({ display_name: m.display_name, created: i === 0 }), i * 3],
  );
}
console.log(`circle "${spec.circle.name}" created, invite code ${spec.circle.invite_code}`);

// 6. Classes (the insert trigger generates the next 7 days of pending occurrences).
const classId: Record<string, Record<string, string>> = {};
for (const m of spec.members) {
  classId[m.first] = {};
  for (const c of m.classes) {
    const row = (
      await sql<{ id: string }>(
        `insert into public.classes (user_id, course_code, name, building_code, days_of_week, start_time, end_time)
         values ($1, $2, $3, $4, $5, $6, $7) returning id`,
        [userId[m.first], c.course_code, c.name ?? null, c.building_code, c.days, c.start, c.end],
      )
    )[0];
    classId[m.first][c.course_code] = row.id;
  }
}
console.log('classes inserted');

// 7. History. Triggers off (the check-in trigger would reject closed windows), explicit timestamps.
await sql(`set session_replication_role = replica`);

// class-days: last N weekdays before today, oldest first
const classDays: string[] = [];
for (let d = 1; classDays.length < spec.history_class_days; d++) {
  const ymd = addDays(today, -d);
  const w = dow(ymd);
  if (w >= 1 && w <= 5) classDays.unshift(ymd);
}
const skipDay = classDays[1]; // second-oldest day, so the streak has a clean run after it
const skipper = spec.members.find((m) => m.first === spec.past_skip_member) ?? spec.members[1];
const payer = spec.members.find((m) => m.first === spec.past_skip_paid_by) ?? spec.members.find((m) => m !== skipper)!;

const personalStreak: Record<string, number> = Object.fromEntries(spec.members.map((m) => [m.first, 0]));
let circleStreak = 0;
let photoIdx = 0;
let checkins = 0;

async function seedCheckin(m: MemberSpec, c: ClassSpec, ymd: string, streakAfter: number, circleAfter: number) {
  const occ = (
    await sql<{ id: string }>(
      `insert into public.class_occurrences
         (class_id, user_id, building_code, date, starts_at, ends_at, window_start, window_end, skip_deadline, status)
       values ($1, $2, $3, $4::date, ${at(ymd, c.start)}, ${at(ymd, c.end)},
               ${at(ymd, c.start)} - interval '10 min', ${at(ymd, c.start)} + interval '15 min',
               ${at(ymd, c.end)} + interval '10 min', 'checked_in')
       returning id`,
      [classId[m.first][c.course_code], userId[m.first], c.building_code, ymd],
    )
  )[0];
  const photos = photoPaths[m.first];
  const photo = photos.length ? photos[photoIdx++ % photos.length] : null;
  const minutes = rand(9); // checked in 0-8 minutes after the start
  const ck = (
    await sql<{ id: string }>(
      `insert into public.checkins (occurrence_id, user_id, photo_path, in_geofence, expires_at, created_at)
       values ($1, $2, $3, true, now() + interval '7 days', ${at(ymd, c.start)} + ($4 || ' minutes')::interval)
       returning id`,
      [occ.id, userId[m.first], photo, minutes],
    )
  )[0];
  await sql(
    `insert into public.feed_events (circle_id, actor_id, occurrence_id, type, ref_id, payload, created_at)
     values ($1, $2, $3, 'checkin', $4, $5, ${at(ymd, c.start)} + ($6 || ' minutes')::interval)`,
    [
      circleId,
      userId[m.first],
      occ.id,
      ck.id,
      JSON.stringify({
        display_name: m.display_name,
        avatar_url: null,
        course_code: c.course_code,
        photo_path: photo,
        photo_back_path: null,
        in_geofence: true,
        personal_streak_after: streakAfter,
        circle_streak_after: circleAfter,
      }),
      minutes,
    ],
  );
  checkins += 1;
}

for (const ymd of classDays) {
  const w = dow(ymd);
  const isSkipDay = ymd === skipDay;
  // streak bookkeeping for the payload numbers (display only; the app computes the real ones on read)
  const dayComplete: Record<string, boolean> = {};
  for (const m of spec.members) {
    const todays = m.classes.filter((c) => c.days.includes(w));
    if (!todays.length) continue;
    const skipsToday = isSkipDay && m === skipper;
    dayComplete[m.first] = !skipsToday;
    personalStreak[m.first] = skipsToday ? 0 : personalStreak[m.first] + 1;
  }
  const anyone = Object.keys(dayComplete).length > 0;
  if (anyone) circleStreak = Object.values(dayComplete).every(Boolean) ? circleStreak + 1 : 0;

  for (const m of spec.members) {
    const todays = m.classes.filter((c) => c.days.includes(w)).sort((a, b) => a.start.localeCompare(b.start));
    for (const [i, c] of todays.entries()) {
      if (isSkipDay && m === skipper && i === 0) {
        // The past skip, with everything that followed it.
        const occ = (
          await sql<{ id: string }>(
            `insert into public.class_occurrences
               (class_id, user_id, building_code, date, starts_at, ends_at, window_start, window_end, skip_deadline, status)
             values ($1, $2, $3, $4::date, ${at(ymd, c.start)}, ${at(ymd, c.end)},
                     ${at(ymd, c.start)} - interval '10 min', ${at(ymd, c.start)} + interval '15 min',
                     ${at(ymd, c.end)} + interval '10 min', 'skipped')
             returning id`,
            [classId[m.first][c.course_code], userId[m.first], c.building_code, ymd],
          )
        )[0];
        const skip = (
          await sql<{ id: string }>(
            `insert into public.skips (occurrence_id, user_id, circle_id, excused, explanation, created_at)
             values ($1, $2, $3, false, $4, ${at(ymd, c.end)} + interval '10 min') returning id`,
            [occ.id, userId[m.first], circleId, 'overslept, my bad'],
          )
        )[0];
        const forfeit = (
          await sql<{ id: string }>(
            `insert into public.forfeits (circle_id, owed_by, skip_id, description, status, marked_paid_by, paid_at, local_date, created_at)
             values ($1, $2, $3, $4, 'paid', $5, ${at(addDays(ymd, 1), '18:00')}, $6::date, ${at(ymd, c.end)} + interval '10 min')
             returning id`,
            [circleId, userId[m.first], skip.id, spec.circle.forfeit_text, userId[payer.first], ymd],
          )
        )[0];
        const ev = async (type: string, ref: string, payload: object, when: string) =>
          (
            await sql<{ id: string }>(
              `insert into public.feed_events (circle_id, actor_id, occurrence_id, type, ref_id, payload, created_at)
               values ($1, $2, $3, $4, $5, $6, ${when}) returning id`,
              [circleId, userId[m.first], occ.id, type, ref, JSON.stringify(payload)],
            )
          )[0].id;
        const skipEv = await ev(
          'skip',
          skip.id,
          {
            display_name: m.display_name,
            course_code: c.course_code,
            starts_at: null,
            personal_streak_before: 1,
            circle_streak_before: 1,
          },
          `${at(ymd, c.end)} + interval '10 min'`,
        );
        await sql(`update public.feed_events set payload = payload || jsonb_build_object('starts_at', ${at(ymd, c.start)}) where id = $1`, [skipEv]);
        await ev(
          'forfeit_owed',
          forfeit.id,
          { display_name: m.display_name, description: spec.circle.forfeit_text, forfeit_id: forfeit.id },
          `${at(ymd, c.end)} + interval '10 min 1 second'`,
        );
        await ev(
          'explanation',
          skip.id,
          { display_name: m.display_name, course_code: c.course_code, text: 'overslept, my bad' },
          `${at(ymd, c.end)} + interval '22 min'`,
        );
        const paidEv = await ev(
          'forfeit_paid',
          forfeit.id,
          {
            display_name: m.display_name,
            paid_by_name: payer.display_name,
            paid_by: userId[payer.first],
            description: spec.circle.forfeit_text,
            forfeit_id: forfeit.id,
          },
          at(addDays(ymd, 1), '18:00'),
        );
        // reactions
        for (const other of spec.members.filter((x) => x !== m).slice(0, 2)) {
          await sql(`insert into public.reactions (feed_event_id, circle_id, user_id, emoji) values ($1, $2, $3, '💀')`, [skipEv, circleId, userId[other.first]]);
        }
        for (const other of spec.members.filter((x) => x !== m).slice(0, 3)) {
          await sql(`insert into public.reactions (feed_event_id, circle_id, user_id, emoji) values ($1, $2, $3, '🧋')`, [paidEv, circleId, userId[other.first]]);
        }
        continue;
      }
      await seedCheckin(m, c, ymd, personalStreak[m.first], circleStreak);
    }
  }
}

// Today: anything whose deadline has already passed is checked in (so today is not a broken day).
{
  const w = dow(today);
  for (const m of spec.members) {
    const todays = m.classes.filter((c) => c.days.includes(w)).sort((a, b) => a.start.localeCompare(b.start));
    for (const c of todays) {
      const passed = (await sql<{ p: boolean }>(`select ${at(today, c.end)} + interval '10 min' < now() as p`))[0].p;
      if (!passed) continue;
      await seedCheckin(m, c, today, personalStreak[m.first] + 1, circleStreak + 1);
    }
  }
}

await sql(`set session_replication_role = origin`);
await sql(`select public.ensure_occurrences($1::date, 2)`, [today]);
console.log(`history: ${classDays.length} class-days, ${checkins} check-ins, one past skip by ${skipper.display_name} (paid by ${payer.display_name})`);

// Real classes later today stay pending on purpose (the app regenerates them on open anyway).
// If one's deadline passes during the judging slot, cron turns it into a real skip on the projector.
{
  const soon = await sql<{ display_name: string; course_code: string; deadline: string }>(
    `select p.display_name, c.course_code, to_char(o.skip_deadline at time zone '${TZ}', 'HH24:MI') as deadline
       from public.class_occurrences o
       join public.classes c on c.id = o.class_id
       join public.profiles p on p.id = o.user_id
      where o.date = $1::date and o.status = 'pending' and not o.is_demo
        and o.skip_deadline < now() + interval '4 hours'
      order by o.skip_deadline`,
    [today],
  );
  if (soon.length) {
    console.warn(`\n! ${soon.length} real class(es) today have skip deadlines in the next 4 h. If one passes during the demo it becomes a real skip:`);
    for (const s of soon) console.warn(`    ${s.display_name.padEnd(10)} ${s.course_code}  deadline ${s.deadline}`);
    console.warn('  Use a schedules.json with no classes near the judging slot, or excuse them from Home before the demo.');
  }
}

// 8. Report.
const cs = (await sql<{ s: number }>(`select public.circle_streak($1) as s`, [circleId]))[0].s;
console.log(`\ncircle streak: ${cs}`);
for (const m of spec.members) {
  const ps = (await sql<{ s: number }>(`select public.personal_streak($1) as s`, [userId[m.first]]))[0].s;
  console.log(`  ${m.display_name.padEnd(10)} ${m.first}@present.demo / ${spec.password}   streak ${ps}`);
}
console.log(`\ninvite code: ${spec.circle.invite_code}\ndemo course: ${spec.demo_course}\n`);
await db.end();
