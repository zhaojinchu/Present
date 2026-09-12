import { useEffect, useState } from 'react';

// Server-corrected clock. get_circle_state() returns server_time; we keep the offset so
// countdowns agree with the Postgres now() that the check-in trigger enforces.
let offsetMs = 0;

export function setServerTime(iso: string) {
  const t = new Date(iso).getTime();
  if (Number.isFinite(t)) offsetMs = t - Date.now();
}

export function serverNow(): Date {
  return new Date(Date.now() + offsetMs);
}

export function serverNowMs(): number {
  return Date.now() + offsetMs;
}

/** Re-renders every `intervalMs` with the current server-corrected time. */
export function useNow(intervalMs = 1000): Date {
  const [t, setT] = useState(serverNow);
  useEffect(() => {
    const id = setInterval(() => setT(serverNow()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return t;
}
