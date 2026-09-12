/* eslint-disable no-console */
// Present v2 — demo seed. Wipes and rebuilds the fake accounts (@present.demo), friendships,
// schedules and two weeks of believable history: on-time posts, one late post, one unexcused miss
// with an explanation and a reply, one excused miss, reactions, comments, circles with a forfeit
// and votes. Members with `existing_username` are real sign-ups that get LINKED into this world
// (friendships, circles, a seed-tagged class with history) and are never deleted; their own
// classes and posts stay. Idempotent: re-running replaces only what the seed made.
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
const BUCKET = 'checkin-photos';

// ---------------------------------------------------------------- config

interface ClassSpec {
  course_code: string;
  name?: string;
  location_text?: string;
  lat?: number;
  lng?: number;
  days: number[];
  start: string; // 'HH:MM'
  end: string;
}
interface MemberSpec {
  first: string;
  username: string;
  display_name: string;
  tz: string;
  classes: ClassSpec[];
  /** A real account to link instead of creating one; matched by profile username. */
  existing_username?: string;
}
interface CircleSpec {
  name: string;
  emoji?: string | null;
  forfeit_text?: string | null;
  created_by: string; // member first
  members: string[]; // member firsts
  /** The miss member's miss owes this circle's forfeit (only if they are a member and it has stakes). */
  forfeit_for?: string;
  /** Votes on that miss: first -> fair? */
  votes?: Record<string, boolean>;
}
interface SeedSpec {
  password: string;
  demo_course: string;
  history_class_days: number;
  late_member: string;
  miss_member: string;
  excused_member: string;
  members: MemberSpec[];
  circles?: CircleSpec[];
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

// ---------------------------------------------------------------- helpers

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const db = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function sql<T = Record<string, any>>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query(text, params)).rows as T[];
}
/** Day of week (0=Sun) of a 'YYYY-MM-DD' date, as a calendar date. */
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
/** A timestamptz expression for a wall-clock date + time in a zone, resolved by Postgres. */
const at = (ymd: string, hhmm: string, tz: string) => `(('${ymd} ${hhmm}')::timestamp at time zone '${tz}')`;

// ---------------------------------------------------------------- main

await db.connect();
const tz0 = spec.members[0].tz;
const today = (await sql<{ d: string }>(`select (now() at time zone '${tz0}')::date::text as d`))[0].d;
console.log(`Seeding against ${SUPABASE_URL} (today in ${tz0}: ${today})`);

// 1. Wipe previous seed users (cascades profiles -> friendships, classes, occurrences, posts, feed).
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
  console.log(`wiped ${deleted} seed users`);
}

// 2. Users (the auth trigger creates profiles with username + tz from the metadata). Linked real
// accounts are looked up by username; the seed's previous classes on them (ics_uid seed:*) go, with
// their occurrences, posts and feed events, so the history is rebuilt cleanly.
const userId: Record<string, string> = {};
const linked = new Set<string>();
for (const m of [...spec.members]) {
  if (m.existing_username) {
    const found = await sql<{ id: string; display_name: string; username: string; tz: string }>(`select id, display_name, username, tz from public.profiles where username = $1`, [m.existing_username]);
    if (!found.length) {
      console.warn(`! @${m.existing_username} (${m.display_name}) has not signed up yet; skipped (re-run the seed after they do)`);
      spec.members = spec.members.filter((x) => x !== m);
      continue;
    }
    userId[m.first] = found[0].id;
    m.username = found[0].username;
    m.display_name = found[0].display_name;
    m.tz = found[0].tz;
    linked.add(m.first);
    await sql(`delete from public.classes where user_id = $1 and ics_uid like 'seed:%'`, [found[0].id]);
    continue;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email: `${m.first}@present.demo`,
    password: spec.password,
    email_confirm: true,
    user_metadata: { display_name: m.display_name, username: m.username, tz: m.tz },
  });
  if (error) throw error;
  userId[m.first] = data.user.id;
}
console.log(`created ${spec.members.length} users`);

// 3. Photos: upload scripts/seed/photos/*.jpg as seed/<user_id>/<n>.jpg.
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
if (!allPhotos.length) console.warn('! no photos in scripts/seed/photos; posts will have no images');
else console.log(`uploaded ${Object.values(photoPaths).flat().length} photos`);

// 4. Friendships: everyone is friends with everyone, since three weeks ago.
{
  let edges = 0;
  for (let i = 0; i < spec.members.length; i++) {
    for (let j = i + 1; j < spec.members.length; j++) {
      const a = userId[spec.members[i].first];
      const b = userId[spec.members[j].first];
      const [lo, hi] = a < b ? [a, b] : [b, a];
      await sql(
        `insert into public.friendships (user_lo, user_hi, requested_by, status, created_at, accepted_at)
         values ($1, $2, $3, 'accepted', now() - interval '22 days', now() - interval '21 days')
         on conflict (user_lo, user_hi) do update set status = 'accepted', accepted_at = coalesce(public.friendships.accepted_at, now())`,
        [lo, hi, a],
      );
      edges += 1;
    }
  }
  // a couple of "became friends" events so the bottom of the feed has an origin
  for (let j = 1; j < spec.members.length; j++) {
    const me = spec.members[0];
    const them = spec.members[j];
    if (linked.has(me.first) || linked.has(them.first)) continue;
    await sql(
      `insert into public.feed_events (actor_id, type, ref_id, payload, created_at)
       values ($1, 'friends', $2, $3, now() - interval '21 days' + ($4 || ' minutes')::interval)`,
      [
        userId[me.first],
        userId[them.first],
        JSON.stringify({ display_name: me.display_name, username: me.username, avatar_url: null, friend_id: userId[them.first], friend_name: them.display_name, friend_username: them.username }),
        j * 4,
      ],
    );
  }
  console.log(`${edges} friendships`);
}

// 5. Classes (the insert trigger generates the next 7 days of pending occurrences).
const classId: Record<string, Record<string, string>> = {};
for (const m of spec.members) {
  classId[m.first] = {};
  for (const c of m.classes) {
    if (linked.has(m.first)) {
      const own = await sql<{ id: string }>(`select id from public.classes where user_id = $1 and course_code = $2 and (term_end is null or term_end >= current_date) limit 1`, [userId[m.first], c.course_code]);
      if (own.length) {
        classId[m.first][c.course_code] = own[0].id;
        continue;
      }
    }
    const row = (
      await sql<{ id: string }>(
        `insert into public.classes (user_id, course_code, name, location_text, lat, lng, radius_m, tz, days_of_week, start_time, end_time, source, ics_uid)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'ics', $12) returning id`,
        [userId[m.first], c.course_code, c.name ?? null, c.location_text ?? null, c.lat ?? null, c.lng ?? null, c.lat != null ? 60 : null, m.tz, c.days, c.start, c.end, linked.has(m.first) ? `seed:${c.course_code}` : null],
      )
    )[0];
    classId[m.first][c.course_code] = row.id;
  }
}
console.log('classes inserted');

// 5b. Circles (groups in the database): replaced on every run.
const circleId: Record<string, string> = {};
for (const g of spec.circles ?? []) {
  const creator = userId[g.created_by];
  const members = g.members.filter((f) => userId[f]);
  if (!creator || members.length === 0) {
    console.warn(`! circle "${g.name}": creator @${g.created_by} not available, skipped`);
    continue;
  }
  await sql(`delete from public.groups where name = $1 and created_by = any($2::uuid[])`, [g.name, Object.values(userId)]);
  const row = (
    await sql<{ id: string }>(
      `insert into public.groups (name, emoji, invite_code, forfeit_text, created_by, created_at)
       values ($1, $2, public.gen_invite_code(), $3, $4, now() - interval '20 days') returning id`,
      [g.name, g.emoji ?? null, g.forfeit_text ?? null, creator],
    )
  )[0];
  circleId[g.name] = row.id;
  for (const [i, f] of [g.created_by, ...members.filter((x) => x !== g.created_by)].entries()) {
    await sql(`insert into public.group_members (group_id, user_id, joined_at) values ($1, $2, now() - interval '20 days' + ($3 || ' hours')::interval) on conflict do nothing`, [row.id, userId[f], i]);
  }
  console.log(`circle "${g.name}": ${members.length} members${g.forfeit_text ? `, stakes "${g.forfeit_text}"` : ''}`);
}

// 6. History. Triggers off (create_post would reject closed windows), explicit timestamps.
await sql(`set session_replication_role = replica`);

// class-days: last N weekdays before today, oldest first
const classDays: string[] = [];
for (let d = 1; classDays.length < spec.history_class_days; d++) {
  const ymd = addDays(today, -d);
  const w = dow(ymd);
  if (w >= 1 && w <= 5) classDays.unshift(ymd);
}
// Recent enough to sit inside the feed's last 50 events, spaced so they never share a day.
const missDay = classDays[Math.max(1, classDays.length - 4)];
const excusedDay = classDays[Math.max(0, classDays.length - 6)];
const lateDay = classDays[Math.max(2, classDays.length - 2)];
const byFirst = (f: string) => spec.members.find((m) => m.first === f) ?? spec.members[1];
const misser = byFirst(spec.miss_member);
const later = byFirst(spec.late_member);
const excused = byFirst(spec.excused_member);

const streak: Record<string, number> = Object.fromEntries(spec.members.map((m) => [m.first, 0]));
let photoIdx = 0;
let postCount = 0;
const eventIds: { id: string; kind: 'post' | 'miss'; who: string }[] = [];
const profileJson = (m: MemberSpec) => ({ display_name: m.display_name, username: m.username, avatar_url: null });

async function insertOccurrence(m: MemberSpec, c: ClassSpec, ymd: string, status: string, late = false, postedAt: string | null = null) {
  return (
    await sql<{ id: string }>(
      `insert into public.class_occurrences
         (class_id, user_id, date, starts_at, ends_at, opens_at, on_time_until, deadline, status, late, posted_at)
       values ($1, $2, $3::date, ${at(ymd, c.start, m.tz)}, ${at(ymd, c.end, m.tz)},
               ${at(ymd, c.start, m.tz)} - interval '2 min', ${at(ymd, c.start, m.tz)} + interval '10 min',
               ${at(ymd, c.end, m.tz)} + interval '10 min', $4, $5, ${postedAt ?? 'null'})
       on conflict (class_id, date) where not is_demo do nothing
       returning id`,
      [classId[m.first][c.course_code], userId[m.first], ymd, status, late],
    )
  )[0]?.id ?? null;
}

async function seedPost(m: MemberSpec, c: ClassSpec, ymd: string, opts: { late?: boolean; minutes?: number; retakes?: number; caption?: string | null; streakAfter: number }) {
  const minutes = opts.minutes ?? rand(9); // posted 0-8 minutes after the start
  const postedAt = `${at(ymd, c.start, m.tz)} + interval '${minutes} minutes'`;
  const occ = await insertOccurrence(m, c, ymd, 'posted', !!opts.late, postedAt);
  if (!occ) return; // the real account already had that day
  const photos = photoPaths[m.first];
  const photo = photos.length ? photos[photoIdx++ % photos.length] : null;
  const verified = c.lat != null;
  const post = (
    await sql<{ id: string }>(
      `insert into public.posts (occurrence_id, user_id, photo_path, photo_back_path, caption, late, location_verified, retake_count, expires_at, memory_until, created_at)
       values ($1, $2, $3, null, $4, $5, $6, $7, now() + interval '7 days', now() + interval '30 days', ${postedAt})
       returning id`,
      [occ, userId[m.first], photo, opts.caption ?? null, !!opts.late, verified, opts.retakes ?? 0],
    )
  )[0];
  const ev = (
    await sql<{ id: string }>(
      `insert into public.feed_events (actor_id, occurrence_id, type, ref_id, payload, created_at)
       values ($1, $2, 'post', $3, $4::jsonb || jsonb_build_object('starts_at', ${at(ymd, c.start, m.tz)}, 'posted_at', ${postedAt}, 'expires_at', now() + interval '7 days'), ${postedAt})
       returning id`,
      [
        userId[m.first],
        occ,
        post.id,
        JSON.stringify({
          ...profileJson(m),
          course_code: c.course_code,
          location_text: c.location_text ?? null,
          photo_path: photo,
          photo_back_path: null,
          caption: opts.caption ?? null,
          late: !!opts.late,
          location_verified: verified,
          retake_count: opts.retakes ?? 0,
          streak_after: opts.streakAfter,
        }),
      ],
    )
  )[0];
  eventIds.push({ id: ev.id, kind: 'post', who: m.first });
  postCount += 1;
}

for (const ymd of classDays) {
  const w = dow(ymd);
  for (const m of spec.members) {
    const todays = m.classes.filter((c) => c.days.includes(w)).sort((a, b) => a.start.localeCompare(b.start));
    if (!todays.length) continue;
    const isMissDay = ymd === missDay && m === misser;
    const isExcusedDay = ymd === excusedDay && m === excused;
    const isLateDay = ymd === lateDay && m === later;

    if (isMissDay) streak[m.first] = 0;
    else if (isLateDay && todays.length === 1) {
      /* a late-only day neither extends nor breaks */
    } else streak[m.first] += 1;

    for (const [i, c] of todays.entries()) {
      if (isMissDay && i === 0) {
        const occ = await insertOccurrence(m, c, ymd, 'missed');
        if (!occ) continue;
        const miss = (
          await sql<{ id: string }>(
            `insert into public.misses (occurrence_id, user_id, excused, explanation, created_at)
             values ($1, $2, false, $3, ${at(ymd, c.end, m.tz)} + interval '10 min') returning id`,
            [occ, userId[m.first], 'overslept, my bad'],
          )
        )[0];
        const ev = (
          await sql<{ id: string }>(
            `insert into public.feed_events (actor_id, occurrence_id, type, ref_id, payload, created_at)
             values ($1, $2, 'miss', $3, $4::jsonb || jsonb_build_object('starts_at', ${at(ymd, c.start, m.tz)}), ${at(ymd, c.end, m.tz)} + interval '10 min') returning id`,
            [userId[m.first], occ, miss.id, JSON.stringify({ ...profileJson(m), course_code: c.course_code, streak_before: 1 })],
          )
        )[0];
        await sql(
          `insert into public.comments (feed_event_id, user_id, text, created_at) values ($1, $2, $3, ${at(ymd, c.end, m.tz)} + interval '22 min')`,
          [ev.id, userId[m.first], 'overslept, my bad'],
        );
        const replier = spec.members.find((x) => x !== m)!;
        await sql(
          `insert into public.comments (feed_event_id, user_id, text, created_at) values ($1, $2, $3, ${at(ymd, c.end, m.tz)} + interval '31 min')`,
          [ev.id, userId[replier.first], 'the boba is on you'],
        );
        for (const other of spec.members.filter((x) => x !== m).slice(0, 2)) {
          await sql(`insert into public.reactions (feed_event_id, user_id, emoji) values ($1, $2, '💀')`, [ev.id, userId[other.first]]);
        }
        eventIds.push({ id: ev.id, kind: 'miss', who: m.first });
        continue;
      }
      if (isExcusedDay && i === 0) {
        const occ = await insertOccurrence(m, c, ymd, 'excused');
        if (!occ) continue;
        const miss = (
          await sql<{ id: string }>(
            `insert into public.misses (occurrence_id, user_id, excused, created_at) values ($1, $2, true, ${at(ymd, c.start, m.tz)} - interval '40 min') returning id`,
            [occ, userId[m.first]],
          )
        )[0];
        await sql(
          `insert into public.feed_events (actor_id, occurrence_id, type, ref_id, payload, created_at)
           values ($1, $2, 'excused', $3, $4, ${at(ymd, c.start, m.tz)} - interval '40 min')`,
          [userId[m.first], occ, miss.id, JSON.stringify({ ...profileJson(m), course_code: c.course_code, pre_emptive: true })],
        );
        continue;
      }
      if (isLateDay && i === 0) {
        await seedPost(m, c, ymd, { late: true, minutes: 22, retakes: 3, caption: 'bus.', streakAfter: streak[m.first] });
        continue;
      }
      await seedPost(m, c, ymd, { streakAfter: streak[m.first], caption: rand(6) === 0 ? ['front row energy', 'awake, technically', 'coffee count: 2', 'prof is late again'][rand(4)] : null, retakes: rand(4) === 0 ? 1 + rand(2) : 0 });
    }
  }
}

// Today: anything whose deadline has already passed is posted on time (so today is not a broken day).
{
  const w = dow(today);
  for (const m of spec.members) {
    const todays = m.classes.filter((c) => c.days.includes(w)).sort((a, b) => a.start.localeCompare(b.start));
    let bumped = false;
    for (const c of todays) {
      const passed = (await sql<{ p: boolean }>(`select ${at(today, c.end, m.tz)} + interval '10 min' < now() as p`))[0].p;
      if (!passed) continue;
      if (!bumped) {
        streak[m.first] += 1;
        bumped = true;
      }
      await seedPost(m, c, today, { streakAfter: streak[m.first] });
    }
  }
}

// Reactions and comments on recent posts.
{
  const recent = eventIds.filter((e) => e.kind === 'post').slice(-8);
  const emojis = ['🔥', '😂', '🫡', '💀', '🧋'];
  const lines = ["where's the prof", 'late again', 'save me a seat', 'is this the 9:30', 'nice light'];
  for (const e of recent) {
    for (const other of shuffle(spec.members.filter((x) => x.first !== e.who)).slice(0, 1 + rand(2))) {
      await sql(`insert into public.reactions (feed_event_id, user_id, emoji) values ($1, $2, $3) on conflict do nothing`, [e.id, userId[other.first], emojis[rand(emojis.length)]]);
    }
    if (rand(2) === 0) {
      const other = spec.members.find((x) => x.first !== e.who)!;
      await sql(`insert into public.comments (feed_event_id, user_id, text, created_at) values ($1, $2, $3, (select created_at + interval '6 minutes' from public.feed_events where id = $1))`, [e.id, userId[other.first], lines[rand(lines.length)]]);
    }
  }
}

// Circles: the miss member's miss owes the forfeit where there are stakes; a couple of votes.
for (const g of spec.circles ?? []) {
  const gid = circleId[g.name];
  if (!gid || !g.forfeit_for || !g.forfeit_text) continue;
  const missRow = await sql<{ id: string }>(
    `select m.id from public.misses m join public.group_members gm on gm.user_id = m.user_id and gm.group_id = $1
      where m.user_id = $2 and not m.excused order by m.created_at desc limit 1`,
    [gid, userId[g.forfeit_for]],
  );
  if (!missRow.length) continue;
  await sql(
    `insert into public.group_forfeits (group_id, miss_id, user_id, status, created_at)
     values ($1, $2, $3, 'owed', (select created_at from public.misses where id = $2)) on conflict do nothing`,
    [gid, missRow[0].id, userId[g.forfeit_for]],
  );
  for (const [f, fair] of Object.entries(g.votes ?? {})) {
    if (!userId[f] || f === g.forfeit_for) continue;
    await sql(`insert into public.miss_votes (miss_id, group_id, user_id, fair) values ($1, $2, $3, $4) on conflict do nothing`, [missRow[0].id, gid, userId[f], fair]);
  }
}

await sql(`set session_replication_role = origin`);
await sql(`select public.ensure_occurrences(current_date - 1, 3)`);
console.log(`history: ${classDays.length} class-days, ${postCount} posts, ${misser.display_name} missed once (explained), ${excused.display_name} excused once, ${later.display_name} posted late once`);

// Real classes later today stay pending on purpose. If one's deadline passes during the judging
// slot, cron turns it into a real miss on the projector.
{
  const soon = await sql<{ display_name: string; course_code: string; deadline: string }>(
    `select p.display_name, c.course_code, to_char(o.deadline at time zone '${tz0}', 'HH24:MI') as deadline
       from public.class_occurrences o
       join public.classes c on c.id = o.class_id
       join public.profiles p on p.id = o.user_id
      where o.status = 'pending' and not o.is_demo and o.deadline < now() + interval '4 hours'
      order by o.deadline`,
  );
  if (soon.length) {
    console.warn(`\n! ${soon.length} real class(es) have deadlines in the next 4 h. If one passes during the demo it becomes a real miss:`);
    for (const s of soon) console.warn(`    ${s.display_name.padEnd(16)} ${s.course_code}  deadline ${s.deadline}`);
    console.warn('  Use a schedules.json with no classes near the judging slot, or tap "Can\'t make it" on them beforehand.');
  }
}

// 7. Report.
console.log('\nleaderboard');
const board = await sql<{ display_name: string; username: string; streak: number; best: number }>(
  `select p.display_name, p.username, public.personal_streak(p.id) as streak, public.best_streak(p.id) as best
     from public.profiles p where p.id = any($1::uuid[]) order by streak desc, p.display_name`,
  [Object.values(userId)],
);
for (const [i, b] of board.entries()) console.log(`  #${i + 1} ${b.display_name.padEnd(16)} @${b.username.padEnd(8)} streak ${b.streak}  best ${b.best}`);
console.log('\nlogins');
for (const m of spec.members) console.log(linked.has(m.first) ? `  ${m.display_name.padEnd(16)} linked real account @${m.username}` : `  ${m.display_name.padEnd(16)} ${m.first}@present.demo / ${spec.password}`);
console.log(`\ndemo course: ${spec.demo_course}\n`);
await db.end();
