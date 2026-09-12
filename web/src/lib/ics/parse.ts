// A small RFC 5545 reader for the weekly-class subset: line unfolding, parameters with quoted
// values, text unescaping, multi-valued EXDATE/RDATE, nested VTIMEZONE/VALARM skipped. No
// dependencies, so it runs in the browser and under tsx alike. Nothing here expands recurrences;
// the database does that day by day from days_of_week, term bounds and exception dates.

export type DateKind = 'date' | 'floating' | 'utc' | 'tzid';

export interface IcsDateTime {
  y: number;
  m: number; // 1-12
  d: number;
  hh: number;
  mm: number;
  ss: number;
  kind: DateKind;
  tzid?: string;
}

export interface RRule {
  freq: string; // WEEKLY, DAILY, ...
  interval: number;
  byday: string[]; // MO, TU, ... (ordinal prefixes stripped)
  until: IcsDateTime | null;
  count: number | null;
}

export interface IcsEvent {
  uid: string;
  summary: string;
  description: string | null;
  location: string | null;
  dtstart: IcsDateTime | null;
  dtend: IcsDateTime | null;
  duration: string | null; // ISO 8601 duration, e.g. PT1H20M
  rrule: RRule | null;
  exdates: IcsDateTime[];
  rdates: IcsDateTime[];
  recurrenceId: IcsDateTime | null;
}

export interface IcsCalendar {
  events: IcsEvent[];
  /** Calendar-level X-WR-TIMEZONE, if present (Google sets it). */
  defaultTzid: string | null;
}

interface Line {
  name: string;
  params: Record<string, string[]>;
  value: string;
}

/** Unfold continuation lines and split each into name, params and value. */
export function tokenize(text: string): Line[] {
  const raw = text.replace(/^﻿/, '').split(/\r\n|\n|\r/);
  const lines: string[] = [];
  for (const l of raw) {
    if ((l.startsWith(' ') || l.startsWith('\t')) && lines.length > 0) lines[lines.length - 1] += l.slice(1);
    else if (l.length > 0) lines.push(l);
  }
  const out: Line[] = [];
  for (const l of lines) {
    // find the first ':' outside double quotes
    let inQ = false;
    let colon = -1;
    for (let i = 0; i < l.length; i++) {
      const ch = l[i];
      if (ch === '"') inQ = !inQ;
      else if (ch === ':' && !inQ) {
        colon = i;
        break;
      }
    }
    if (colon < 0) continue;
    const head = l.slice(0, colon);
    const value = l.slice(colon + 1);
    const parts = splitOutsideQuotes(head, ';');
    const name = (parts.shift() ?? '').toUpperCase();
    const params: Record<string, string[]> = {};
    for (const p of parts) {
      const eq = p.indexOf('=');
      if (eq < 0) continue;
      const k = p.slice(0, eq).toUpperCase();
      const v = splitOutsideQuotes(p.slice(eq + 1), ',').map((s) => s.replace(/^"|"$/g, ''));
      params[k] = (params[k] ?? []).concat(v);
    }
    out.push({ name, params, value });
  }
  return out;
}

function splitOutsideQuotes(s: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (const ch of s) {
    if (ch === '"') {
      inQ = !inQ;
      cur += ch;
    } else if (ch === sep && !inQ) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

export function unescapeText(v: string): string {
  return v.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\').trim();
}

export function parseDateTime(value: string, params: Record<string, string[]> = {}): IcsDateTime | null {
  const v = value.trim();
  const isDate = (params.VALUE?.[0] ?? '').toUpperCase() === 'DATE' || /^\d{8}$/.test(v);
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (isDate || !m[4]) return { y, m: mo, d, hh: 0, mm: 0, ss: 0, kind: 'date' };
  const hh = Number(m[4]);
  const mm = Number(m[5]);
  const ss = Number(m[6] ?? '0');
  if (m[7] === 'Z') return { y, m: mo, d, hh, mm, ss, kind: 'utc' };
  const tzid = params.TZID?.[0];
  return tzid ? { y, m: mo, d, hh, mm, ss, kind: 'tzid', tzid } : { y, m: mo, d, hh, mm, ss, kind: 'floating' };
}

export function parseRRule(value: string): RRule | null {
  const r: RRule = { freq: '', interval: 1, byday: [], until: null, count: null };
  for (const part of value.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const k = part.slice(0, eq).toUpperCase();
    const v = part.slice(eq + 1);
    if (k === 'FREQ') r.freq = v.toUpperCase();
    else if (k === 'INTERVAL') r.interval = Math.max(1, Number(v) || 1);
    else if (k === 'BYDAY') r.byday = v.split(',').map((s) => s.trim().replace(/^[+-]?\d+/, '').toUpperCase()).filter(Boolean);
    else if (k === 'UNTIL') r.until = parseDateTime(v);
    else if (k === 'COUNT') r.count = Number(v) || null;
  }
  return r.freq ? r : null;
}

function emptyEvent(): IcsEvent {
  return { uid: '', summary: '', description: null, location: null, dtstart: null, dtend: null, duration: null, rrule: null, exdates: [], rdates: [], recurrenceId: null };
}

export function parseIcs(text: string): IcsCalendar {
  const lines = tokenize(text);
  const events: IcsEvent[] = [];
  const stack: string[] = [];
  let cur: IcsEvent | null = null;
  let defaultTzid: string | null = null;
  for (const l of lines) {
    if (l.name === 'BEGIN') {
      const comp = l.value.trim().toUpperCase();
      stack.push(comp);
      if (comp === 'VEVENT') cur = emptyEvent();
      continue;
    }
    if (l.name === 'END') {
      const comp = l.value.trim().toUpperCase();
      stack.pop();
      if (comp === 'VEVENT' && cur) {
        if (cur.dtstart) events.push(cur);
        cur = null;
      }
      continue;
    }
    const top = stack[stack.length - 1];
    if (top === 'VCALENDAR' && l.name === 'X-WR-TIMEZONE') {
      defaultTzid = l.value.trim() || null;
      continue;
    }
    if (top !== 'VEVENT' || !cur) continue; // VALARM, VTIMEZONE, STANDARD, DAYLIGHT: ignored
    switch (l.name) {
      case 'UID':
        cur.uid = l.value.trim();
        break;
      case 'SUMMARY':
        cur.summary = unescapeText(l.value);
        break;
      case 'DESCRIPTION':
        cur.description = unescapeText(l.value) || null;
        break;
      case 'LOCATION':
        cur.location = unescapeText(l.value) || null;
        break;
      case 'DTSTART':
        cur.dtstart = parseDateTime(l.value, l.params);
        break;
      case 'DTEND':
        cur.dtend = parseDateTime(l.value, l.params);
        break;
      case 'DURATION':
        cur.duration = l.value.trim();
        break;
      case 'RRULE':
        cur.rrule = parseRRule(l.value);
        break;
      case 'EXDATE':
        for (const v of l.value.split(',')) {
          const dt = parseDateTime(v, l.params);
          if (dt) cur.exdates.push(dt);
        }
        break;
      case 'RDATE':
        for (const v of l.value.split(',')) {
          const dt = parseDateTime(v.split('/')[0], l.params);
          if (dt) cur.rdates.push(dt);
        }
        break;
      case 'RECURRENCE-ID':
        cur.recurrenceId = parseDateTime(l.value, l.params);
        break;
      default:
        break;
    }
  }
  return { events, defaultTzid };
}

/** Minutes in an ISO 8601 duration like PT1H20M or P1DT2H. */
export function durationMinutes(s: string): number | null {
  const m = s.match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i);
  if (!m) return null;
  const w = Number(m[2] ?? 0);
  const d = Number(m[3] ?? 0);
  const h = Number(m[4] ?? 0);
  const mi = Number(m[5] ?? 0);
  const sec = Number(m[6] ?? 0);
  const total = ((w * 7 + d) * 24 + h) * 60 + mi + Math.round(sec / 60);
  return m[1] === '-' ? -total : total;
}
