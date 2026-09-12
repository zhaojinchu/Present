// From calendar events to class drafts the database can expand: weekly shape, term bounds,
// exception dates, time zone, course code. Anything that is not a weekly class is reported
// with a reason so the user sees what was left out.
import type { ImportClassInput } from '../types';
import { splitSummary } from './course';
import { durationMinutes, type IcsCalendar, type IcsEvent } from './parse';
import { addDays, dateInTz, dowOfYmd, resolveTzid, toLocal } from './tz';

export interface ClassDraft extends ImportClassInput {
  key: string; // stable id in the review list
  included: boolean;
  warnings: string[];
  weeks: number; // for display
}

export interface Skipped {
  summary: string;
  reason: string;
}

export interface DraftResult {
  drafts: ClassDraft[];
  skipped: Skipped[];
}

const DAY: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
const MAX_CLASS_MIN = 4 * 60;
const DEFAULT_WEEKS = 16;

function addMinutes(time: string, min: number): string {
  const [h, m] = time.split(':').map(Number);
  const t = ((h * 60 + m + min) % 1440 + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

function nthMatchingDate(start: string, days: number[], count: number): string {
  let d = start;
  let seen = 0;
  for (let i = 0; i < 400 && seen < count; i++) {
    if (days.includes(dowOfYmd(d))) {
      seen += 1;
      if (seen === count) return d;
    }
    d = addDays(d, 1);
  }
  return d;
}

function weeksBetween(a: string, b: string): number {
  const days = (Date.parse(b) - Date.parse(a)) / 86_400_000 + 1;
  return Math.max(1, Math.ceil(days / 7));
}

export function toClassDrafts(cal: IcsCalendar, defaultTz: string, today = new Date().toISOString().slice(0, 10)): DraftResult {
  const drafts: ClassDraft[] = [];
  const skipped: Skipped[] = [];

  // group by UID: one master, any number of RECURRENCE-ID overrides
  const groups = new Map<string, { master: IcsEvent | null; overrides: IcsEvent[] }>();
  cal.events.forEach((e, i) => {
    const uid = e.uid || `no-uid-${i}`;
    const g = groups.get(uid) ?? { master: null, overrides: [] };
    if (e.recurrenceId) g.overrides.push(e);
    else if (!g.master) g.master = e;
    groups.set(uid, g);
  });

  for (const [uid, g] of groups) {
    const e = g.master;
    if (!e) {
      skipped.push({ summary: g.overrides[0]?.summary ?? uid, reason: 'only a changed session, no series' });
      continue;
    }
    const label = e.summary || uid;
    if (!e.dtstart) continue;
    if (e.dtstart.kind === 'date') {
      skipped.push({ summary: label, reason: 'all-day' });
      continue;
    }
    const warnings: string[] = [];
    const tz = resolveTzid(e.dtstart.tzid) ?? resolveTzid(cal.defaultTzid) ?? defaultTz;
    if (e.dtstart.kind === 'tzid' && !resolveTzid(e.dtstart.tzid)) warnings.push(`unknown zone "${e.dtstart.tzid}", assumed ${tz}`);
    const start = toLocal(e.dtstart, tz);
    let endTime: string | null = null;
    if (e.dtend) endTime = toLocal(e.dtend, tz).time;
    else if (e.duration) {
      const mins = durationMinutes(e.duration);
      if (mins && mins > 0) endTime = addMinutes(start.time, mins);
    }
    if (!endTime || endTime <= start.time) {
      skipped.push({ summary: label, reason: 'no end time' });
      continue;
    }
    const lengthMin = (Number(endTime.slice(0, 2)) * 60 + Number(endTime.slice(3))) - (Number(start.time.slice(0, 2)) * 60 + Number(start.time.slice(3)));
    if (lengthMin > MAX_CLASS_MIN) {
      skipped.push({ summary: label, reason: 'longer than 4 hours' });
      continue;
    }
    if (e.dtstart.kind === 'utc') warnings.push(start.shiftedDays !== 0 ? 'converted from UTC; check the day' : 'times were given in UTC; check them after a clock change');

    const { course_code, name, kind } = splitSummary(label);
    const fullName = kind && name ? `${name} (${kind})` : kind && !name ? kind : name;
    const base = { course_code, name: fullName, location_text: e.location, tz, start_time: start.time, end_time: endTime };

    if (!e.rrule) {
      // one-off (exam, review session): offered but unchecked
      drafts.push({ ...base, ics_uid: uid, days_of_week: [start.dow], term_start: start.date, term_end: start.date, exdates: [], key: uid, included: false, warnings: ['one-off session'], weeks: 1 });
      continue;
    }
    const r = e.rrule;
    if (r.freq !== 'WEEKLY' || r.interval !== 1) {
      skipped.push({ summary: label, reason: r.freq === 'WEEKLY' ? `every ${r.interval} weeks` : `repeats ${r.freq.toLowerCase()}` });
      continue;
    }
    let days = r.byday.map((d) => DAY[d]).filter((d) => d !== undefined);
    if (days.length === 0) days = [start.dow];
    if (start.shiftedDays !== 0) days = days.map((d) => (d + start.shiftedDays + 7) % 7);
    days = [...new Set(days)].sort((a, b) => a - b);

    const term_start = start.date;
    let term_end: string;
    if (r.until) term_end = dateInTz(r.until, tz);
    else if (r.count) term_end = nthMatchingDate(term_start, days, r.count);
    else {
      term_end = addDays(term_start, DEFAULT_WEEKS * 7 - 1);
      warnings.push(`no end date, assumed ${DEFAULT_WEEKS} weeks`);
    }
    const exdates = new Set<string>();
    for (const x of e.exdates) exdates.add(dateInTz(x, tz));
    for (const o of g.overrides) if (o.recurrenceId) exdates.add(dateInTz(o.recurrenceId, tz));
    const extra = e.rdates.filter((x) => !days.includes(toLocal(x, tz).dow)).length;
    if (extra > 0) warnings.push(`${extra} extra session${extra > 1 ? 's' : ''} not imported`);
    let included = true;
    if (term_end < today) {
      included = false;
      warnings.push('term already ended');
    }
    drafts.push({
      ...base,
      ics_uid: uid,
      days_of_week: days,
      term_start,
      term_end,
      exdates: [...exdates].sort(),
      key: uid,
      included,
      warnings,
      weeks: weeksBetween(term_start, term_end),
    });
  }

  return { drafts: mergeSiblings(drafts), skipped };
}

/** Feeds that emit one VEVENT per weekday (some registrars do) collapse into one class. */
export function mergeSiblings(drafts: ClassDraft[]): ClassDraft[] {
  const byKey = new Map<string, ClassDraft>();
  const uids = new Map<string, string[]>();
  for (const d of drafts) {
    const k = [d.course_code, d.name ?? '', d.location_text ?? '', d.start_time, d.end_time, d.term_start, d.term_end, d.tz].join('|');
    const prev = byKey.get(k);
    if (!prev) {
      byKey.set(k, { ...d });
      uids.set(k, [d.ics_uid ?? d.key]);
      continue;
    }
    prev.days_of_week = [...new Set([...prev.days_of_week, ...d.days_of_week])].sort((a, b) => a - b);
    prev.exdates = [...new Set([...prev.exdates, ...d.exdates])].sort();
    prev.included = prev.included || d.included;
    prev.warnings = [...new Set([...prev.warnings, ...d.warnings])];
    uids.get(k)!.push(d.ics_uid ?? d.key);
  }
  return [...byKey.entries()].map(([k, d]) => {
    const list = uids.get(k)!;
    if (list.length > 1) {
      const joined = [...list].sort().join('+');
      return { ...d, ics_uid: joined, key: joined };
    }
    return d;
  });
}

/** What the database needs, from the checked drafts. */
export function toImportRows(drafts: ClassDraft[]): ImportClassInput[] {
  return drafts
    .filter((d) => d.included)
    .map(({ ics_uid, course_code, name, location_text, days_of_week, start_time, end_time, tz, term_start, term_end, exdates }) => ({
      ics_uid,
      course_code,
      name,
      location_text,
      days_of_week,
      start_time,
      end_time,
      tz,
      term_start,
      term_end,
      exdates,
    }));
}
