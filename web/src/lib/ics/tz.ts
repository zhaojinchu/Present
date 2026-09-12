// Time-zone resolution for calendar feeds. IANA names pass through; the common Windows names
// (Outlook exports) map to IANA; anything else falls back to the user's own zone.
import type { IcsDateTime } from './parse';

const WINDOWS: Record<string, string> = {
  'eastern standard time': 'America/New_York',
  'eastern daylight time': 'America/New_York',
  'us eastern standard time': 'America/Indiana/Indianapolis',
  'central standard time': 'America/Chicago',
  'central daylight time': 'America/Chicago',
  'mountain standard time': 'America/Denver',
  'us mountain standard time': 'America/Phoenix',
  'pacific standard time': 'America/Los_Angeles',
  'pacific daylight time': 'America/Los_Angeles',
  'alaskan standard time': 'America/Anchorage',
  'hawaiian standard time': 'Pacific/Honolulu',
  'atlantic standard time': 'America/Halifax',
  'gmt standard time': 'Europe/London',
  'greenwich standard time': 'Atlantic/Reykjavik',
  'w. europe standard time': 'Europe/Berlin',
  'central europe standard time': 'Europe/Budapest',
  'central european standard time': 'Europe/Warsaw',
  'romance standard time': 'Europe/Paris',
  'e. europe standard time': 'Europe/Chisinau',
  'gtb standard time': 'Europe/Athens',
  'india standard time': 'Asia/Kolkata',
  'china standard time': 'Asia/Shanghai',
  'singapore standard time': 'Asia/Singapore',
  'tokyo standard time': 'Asia/Tokyo',
  'korea standard time': 'Asia/Seoul',
  'aus eastern standard time': 'Australia/Sydney',
  'new zealand standard time': 'Pacific/Auckland',
  utc: 'UTC',
  gmt: 'UTC',
  z: 'UTC',
};

export function isValidTz(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** IANA zone for a TZID, or null when it cannot be resolved. */
export function resolveTzid(tzid: string | undefined | null): string | null {
  if (!tzid) return null;
  const t = tzid.trim().replace(/^\//, ''); // some feeds prefix a slash: /America/New_York
  if (isValidTz(t)) return t;
  const win = WINDOWS[t.toLowerCase()];
  if (win) return win;
  // "(UTC-05:00) Eastern Time (US & Canada)" style
  const m = t.match(/eastern|central|mountain|pacific/i);
  if (m) return WINDOWS[`${m[0].toLowerCase()} standard time`] ?? null;
  return null;
}

export interface LocalWallClock {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  dow: number; // 0=Sun
  /** -1, 0 or 1: how the local calendar day moved relative to the feed's own date (UTC conversions only). */
  shiftedDays: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

function dowOf(y: number, m: number, d: number): number {
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** The wall-clock date and time of a feed timestamp in the class's own zone. */
export function toLocal(dt: IcsDateTime, tz: string): LocalWallClock {
  if (dt.kind !== 'utc') {
    return { date: `${dt.y}-${pad(dt.m)}-${pad(dt.d)}`, time: `${pad(dt.hh)}:${pad(dt.mm)}`, dow: dowOf(dt.y, dt.m, dt.d), shiftedDays: 0 };
  }
  const instant = Date.UTC(dt.y, dt.m - 1, dt.d, dt.hh, dt.mm, dt.ss);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(instant));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0');
  const y = get('year');
  const m = get('month');
  const d = get('day');
  const hh = get('hour') % 24;
  const mm = get('minute');
  const local = Date.UTC(y, m - 1, d);
  const feedDay = Date.UTC(dt.y, dt.m - 1, dt.d);
  return { date: `${y}-${pad(m)}-${pad(d)}`, time: `${pad(hh)}:${pad(mm)}`, dow: dowOf(y, m, d), shiftedDays: Math.round((local - feedDay) / 86_400_000) };
}

/** The local calendar date (YYYY-MM-DD) of a feed timestamp in a zone; used for UNTIL and EXDATE. */
export function dateInTz(dt: IcsDateTime, tz: string): string {
  return toLocal(dt, tz).date;
}

export function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function dowOfYmd(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return dowOf(y, m, d);
}
