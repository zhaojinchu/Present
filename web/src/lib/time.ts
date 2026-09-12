// Formatting helpers. All output is in the viewer's own time zone (the browser's), which is what
// a person expects to read; the database keeps everything as instants.

// Pinned to en-US so the demo reads the same on every phone and on the projector.
const LOCALE = 'en-US';
const timeFmt = new Intl.DateTimeFormat(LOCALE, { hour: 'numeric', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', month: 'short', day: 'numeric' });
const weekdayFmt = new Intl.DateTimeFormat(LOCALE, { weekday: 'long' });

function toDate(v: string | number | Date): Date {
  return v instanceof Date ? v : new Date(v);
}

/** "9:30 AM" */
export function fmtTime(v: string | number | Date): string {
  return timeFmt.format(toDate(v));
}

/** "9:30 AM to 10:20 AM" without the repeated meridiem when it matches: "9:30 to 10:20 AM". */
export function fmtRange(a: string | number | Date, b: string | number | Date): string {
  const s = fmtTime(a);
  const e = fmtTime(b);
  const sm = s.slice(-2);
  const em = e.slice(-2);
  return sm === em ? `${s.slice(0, -3)} to ${e}` : `${s} to ${e}`;
}

/** "Fri, Sep 12" */
export function fmtDate(v: string | number | Date): string {
  return dayFmt.format(toDate(v));
}

/** "Friday" */
export function fmtWeekday(v: string | number | Date): string {
  return weekdayFmt.format(toDate(v));
}

/** "Today", "Yesterday", or "Wed, Sep 10". */
export function dayLabel(v: string | number | Date, nowMs = Date.now()): string {
  const d = toDate(v);
  const n = new Date(nowMs);
  const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const nn = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  const diff = Math.round((nn - dd) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return fmtDate(d);
}

/** Local YYYY-MM-DD key for grouping. */
export function dayKey(v: string | number | Date): string {
  const d = toDate(v);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** "now", "4m", "2h", "3d" */
export function relative(v: string | number | Date, nowMs = Date.now()): string {
  const ms = nowMs - toDate(v).getTime();
  const s = Math.round(ms / 1000);
  if (s < 45) return 'now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  return `${d}d`;
}

/** "12:04" for under an hour, "1:02:04" beyond. Never negative. */
export function fmtCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return h > 0 ? `${h}:${mm}:${String(s).padStart(2, '0')}` : `${mm}:${String(s).padStart(2, '0')}`;
}

export const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** [1,3,5] -> "MWF"; [2,4] -> "TTh"; otherwise "Mon, Wed" style. */
export function fmtDays(days: number[]): string {
  const set = [...new Set(days)].sort((a, b) => a - b);
  const letters: Record<number, string> = { 0: 'Su', 1: 'M', 2: 'T', 3: 'W', 4: 'Th', 5: 'F', 6: 'Sa' };
  if (set.length >= 2 && set.every((d) => d >= 1 && d <= 5)) return set.map((d) => letters[d]).join('');
  return set.map((d) => DOW_SHORT[d]).join(', ');
}

/** "09:30:00" -> "9:30 AM" (a wall-clock time with no date). */
export function fmtClock(hhmmss: string): string {
  const [h, m] = hhmmss.split(':').map(Number);
  const d = new Date(2000, 0, 1, h, m);
  return fmtTime(d);
}
