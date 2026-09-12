/* eslint-disable no-console */
// Exercises the calendar import against feeds from four producers. `npm run ics:test`
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitSummary } from '../web/src/lib/ics/course.js';
import { parseIcs } from '../web/src/lib/ics/parse.js';
import { mergeSiblings, toClassDrafts, toImportRows, type ClassDraft } from '../web/src/lib/ics/toClasses.js';
import { resolveTzid } from '../web/src/lib/ics/tz.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => fs.readFileSync(path.join(here, 'fixtures', 'ics', name), 'utf8');
const TODAY = '2026-09-12';

let passed = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (e) {
    console.log(`  FAIL ${name}`);
    throw e;
  }
}
const byCode = (drafts: ClassDraft[], code: string) => drafts.find((d) => d.course_code === code)!;

console.log('course codes');
await test('splitSummary handles the common shapes', () => {
  const cases: [string, string, string | null][] = [
    ['15-122 Principles of Imperative Computation Lec 1', '15-122', 'Principles of Imperative Computation 1 (lecture)'],
    ['15-122 Principles of Imperative Computation Recitation A', '15-122', 'Principles of Imperative Computation A (recitation)'],
    ['Lecture, CS 61A', 'CS 61A', 'lecture'],
    ['MATH 1A Discussion', 'MATH 1A', 'recitation'],
    ['COMP 110 - Introduction to Programming', 'COMP 110', 'Introduction to Programming'],
    ['6.006 Intro to Algorithms', '6.006', 'Intro to Algorithms'],
    ['ECE-101L Circuits Lab', 'ECE 101L', 'Circuits (lab)'],
    ['Studio night', 'Studio night', null],
  ];
  for (const [s, code, name] of cases) {
    const r = splitSummary(s);
    const full = r.kind && r.name ? `${r.name} (${r.kind})` : r.kind && !r.name ? r.kind : r.name;
    assert.equal(r.course_code, code, s);
    assert.equal(full, name, s);
  }
});

await test('resolveTzid: IANA passthrough, Windows names, garbage', () => {
  assert.equal(resolveTzid('America/New_York'), 'America/New_York');
  assert.equal(resolveTzid('/Europe/London'), 'Europe/London');
  assert.equal(resolveTzid('Eastern Standard Time'), 'America/New_York');
  assert.equal(resolveTzid('Pacific Standard Time'), 'America/Los_Angeles');
  assert.equal(resolveTzid('(UTC-06:00) Central Time (US & Canada)'), 'America/Chicago');
  assert.equal(resolveTzid('Mars/Phobos'), null);
  assert.equal(resolveTzid(undefined), null);
});

console.log('\nfeeds');
await test('CMU SIO: TZID, BYDAY, UNTIL in UTC, EXDATE, lecture + recitation', () => {
  const cal = parseIcs(fixture('cmu-sio.ics'));
  assert.equal(cal.events.length, 4);
  const { drafts, skipped } = toClassDrafts(cal, 'UTC', TODAY);
  assert.equal(skipped.length, 0);
  assert.equal(drafts.length, 4);
  const lec = drafts.find((d) => d.ics_uid === 'sio-f26-15122-lec1@cmu.edu')!;
  assert.equal(lec.course_code, '15-122');
  assert.deepEqual(lec.days_of_week, [1, 3, 5]);
  assert.equal(lec.start_time, '09:30');
  assert.equal(lec.end_time, '10:20');
  assert.equal(lec.tz, 'America/New_York');
  assert.equal(lec.location_text, 'GHC 4401');
  assert.equal(lec.term_start, '2026-08-24');
  assert.equal(lec.term_end, '2026-12-11', 'UNTIL 04:59:59Z is the previous local day');
  assert.deepEqual(lec.exdates, ['2026-09-07']);
  assert.equal(lec.included, true);
  assert.equal(lec.weeks, 16);
  const rec = drafts.find((d) => d.ics_uid === 'sio-f26-15122-rec-a@cmu.edu')!;
  assert.deepEqual(rec.days_of_week, [2, 4]);
  assert.match(rec.name ?? '', /recitation/);
  assert.deepEqual(byCode(drafts, '21-241').exdates, ['2026-09-07', '2026-11-27']);
});

await test('Google: VTIMEZONE skipped, multi-value EXDATE, override, all-day, exam, folded lines, escapes', () => {
  const cal = parseIcs(fixture('google-exdate-until.ics'));
  assert.equal(cal.defaultTzid, 'America/Los_Angeles');
  assert.equal(cal.events.length, 4, 'master, override, all-day, exam');
  const { drafts, skipped } = toClassDrafts(cal, 'UTC', TODAY);
  assert.deepEqual(skipped.map((s) => s.reason), ['all-day']);
  const cs = byCode(drafts, 'CS 61A');
  assert.equal(cs.tz, 'America/Los_Angeles');
  assert.equal(cs.name, 'lecture');
  assert.equal(cs.location_text, 'Wheeler Hall 150, Berkeley');
  assert.deepEqual(cs.days_of_week, [1, 3, 5]);
  assert.equal(cs.term_end, '2026-12-11');
  assert.deepEqual(cs.exdates, ['2026-09-07', '2026-10-09', '2026-11-25', '2026-11-27'], 'EXDATEs plus the moved session');
  const exam = drafts.find((d) => d.ics_uid === 'final-exam@google.com')!;
  assert.equal(exam.included, false, 'one-off is offered but unchecked');
  assert.equal(exam.term_start, '2026-12-15');
  assert.equal(exam.location_text, 'RSF Fieldhouse, Berkeley', 'folded line with a leading space');
  assert.equal(exam.end_time, '11:00');
});

await test('Outlook: CRLF, quoted Windows TZID, DURATION, COUNT, biweekly skipped', () => {
  const text = fixture('outlook-count.ics').replace(/\n/g, '\r\n');
  const cal = parseIcs(text);
  const { drafts, skipped } = toClassDrafts(cal, 'UTC', TODAY);
  assert.equal(drafts.length, 1);
  assert.deepEqual(skipped.map((s) => s.reason), ['every 2 weeks']);
  const c = drafts[0];
  assert.equal(c.course_code, 'COMP 110');
  assert.equal(c.name, 'Introduction to Programming');
  assert.equal(c.tz, 'America/New_York');
  assert.equal(c.start_time, '14:00');
  assert.equal(c.end_time, '15:20', 'from DURATION PT1H20M');
  assert.deepEqual(c.days_of_week, [2, 4]);
  assert.equal(c.term_start, '2026-09-01');
  assert.equal(c.term_end, '2026-12-10', '30th Tue/Thu from 1 Sep');
});

await test('Apple: floating with no BYDAY, UTC instants shift days, long event skipped, defaults', () => {
  const cal = parseIcs(fixture('apple-floating.ics'));
  const { drafts, skipped } = toClassDrafts(cal, 'America/Los_Angeles', TODAY);
  assert.deepEqual(skipped.map((s) => s.reason), ['longer than 4 hours']);
  const math = byCode(drafts, 'MATH 1A');
  assert.deepEqual(math.days_of_week, [3], 'from the DTSTART weekday');
  assert.equal(math.tz, 'America/Los_Angeles', 'floating takes the user zone');
  assert.equal(math.term_end, '2026-12-09');
  const algo = byCode(drafts, '6.006');
  assert.equal(algo.start_time, '06:30', '13:30Z in Los Angeles');
  assert.equal(algo.end_time, '07:50');
  assert.ok(algo.warnings.some((w) => /UTC/.test(w)));
  assert.deepEqual(algo.days_of_week, [2, 4]);
});

await test('mergeSiblings collapses one-event-per-weekday feeds with a stable joined uid', () => {
  const mk = (uid: string, day: number): ClassDraft => ({ ics_uid: uid, key: uid, course_code: 'X 1', name: null, location_text: 'R', days_of_week: [day], start_time: '09:00', end_time: '09:50', tz: 'UTC', term_start: '2026-09-01', term_end: '2026-12-01', exdates: [], included: true, warnings: [], weeks: 14 });
  const merged = mergeSiblings([mk('b', 3), mk('a', 1), mk('c', 5)]);
  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0].days_of_week, [1, 3, 5]);
  assert.equal(merged[0].ics_uid, 'a+b+c');
  const again = mergeSiblings([mk('c', 5), mk('a', 1), mk('b', 3)]);
  assert.equal(again[0].ics_uid, 'a+b+c', 'order independent');
});

await test('toImportRows sends only checked drafts, only the database columns', () => {
  const cal = parseIcs(fixture('google-exdate-until.ics'));
  const { drafts } = toClassDrafts(cal, 'UTC', TODAY);
  const rows = toImportRows(drafts);
  assert.equal(rows.length, 1);
  assert.deepEqual(Object.keys(rows[0]).sort(), ['course_code', 'days_of_week', 'end_time', 'exdates', 'ics_uid', 'location_text', 'name', 'start_time', 'term_end', 'term_start', 'tz']);
});

await test('re-parsing a fixture yields identical uids (idempotent re-import)', () => {
  const a = toClassDrafts(parseIcs(fixture('cmu-sio.ics')), 'UTC', TODAY).drafts.map((d) => d.ics_uid);
  const b = toClassDrafts(parseIcs(fixture('cmu-sio.ics')), 'UTC', TODAY).drafts.map((d) => d.ics_uid);
  assert.deepEqual(a, b);
});

console.log(`\n${passed} tests passed`);
