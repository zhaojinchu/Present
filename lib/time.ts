import { TZ } from './config';

const dayKeyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const timeFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
const dayLabelFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' });
const clockFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', hour: 'numeric', minute: '2-digit' });

export function toDate(v: string | number | Date): Date {
  return v instanceof Date ? v : new Date(v);
}

// Intl.format throws on an invalid Date, which would crash a whole list render; degrade to ''.
function valid(d: Date): boolean {
  return Number.isFinite(d.getTime());
}

/** 'YYYY-MM-DD' in America/New_York. */
export function dayKey(v: string | number | Date): string {
  const d = toDate(v);
  return valid(d) ? dayKeyFmt.format(d) : '';
}

export function todayKey(nowMs = Date.now()): string {
  return dayKey(nowMs);
}

/** '9:30 AM' */
export function fmtTime(v: string | number | Date): string {
  const d = toDate(v);
  return valid(d) ? timeFmt.format(d) : '';
}

/** '09:30:00' (Postgres time) -> '9:30 AM' */
export function fmtClock(t: string): string {
  const [h, m] = t.split(':').map(Number);
  return clockFmt.format(new Date(Date.UTC(2000, 0, 1, h || 0, m || 0)));
}

/** 252000 ms -> '4:12' */
export function fmtCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function dayLabel(v: string | number | Date, nowMs = Date.now()): string {
  const d = toDate(v);
  if (!valid(d)) return '';
  const k = dayKey(d);
  if (k === dayKey(nowMs)) return 'Today';
  if (k === dayKey(nowMs - 86_400_000)) return 'Yesterday';
  return dayLabelFmt.format(d);
}

/** 'just now' / '3m ago' / '2h ago' / 'Yesterday 9:31 AM' */
export function relative(v: string | number | Date, nowMs = Date.now()): string {
  const d = toDate(v);
  if (!valid(d)) return '';
  const diff = nowMs - d.getTime();
  if (diff < 45_000) return 'just now';
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (dayKey(d) === dayKey(nowMs)) return `${Math.round(diff / 3_600_000)}h ago`;
  return `${dayLabel(d, nowMs)} ${fmtTime(d)}`;
}

const igDateFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, month: 'long', day: 'numeric' });

/** Instagram-style timestamp: "2 hours ago", "1 day ago", "September 3". */
export function igTime(v: string | number | Date, nowMs = Date.now()): string {
  const d = toDate(v);
  if (!valid(d)) return '';
  const diff = nowMs - d.getTime();
  if (diff < 45_000) return 'just now';
  if (diff < 3_600_000) {
    const m = Math.max(1, Math.round(diff / 60_000));
    return m === 1 ? '1 minute ago' : `${m} minutes ago`;
  }
  if (diff < 86_400_000) {
    const h = Math.max(1, Math.round(diff / 3_600_000));
    return h === 1 ? '1 hour ago' : `${h} hours ago`;
  }
  if (diff < 7 * 86_400_000) {
    const days = Math.max(1, Math.round(diff / 86_400_000));
    return days === 1 ? '1 day ago' : `${days} days ago`;
  }
  return igDateFmt.format(d);
}

export const DOW_SHORT = ['Su', 'M', 'T', 'W', 'Th', 'F', 'Sa'];
export const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** [1,3,5] -> 'MWF' */
export function fmtDays(days: number[]): string {
  return [...days].sort((a, b) => a - b).map((d) => DOW_SHORT[d] ?? '?').join('');
}
