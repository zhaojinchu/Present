// A single notion of "now": server time offset (from get_state) plus a dev offset the demo panel can
// set to preview any phase without touching the database. Everything time-based reads through here.
import { useEffect, useState } from 'react';

let serverOffsetMs = 0;
let devOffsetMs = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function setServerTime(iso: string) {
  const t = Date.parse(iso);
  if (Number.isFinite(t)) serverOffsetMs = t - Date.now();
}

export function setDevOffsetMinutes(min: number) {
  devOffsetMs = Math.round(min * 60_000);
  emit();
}

export function getDevOffsetMinutes(): number {
  return devOffsetMs / 60_000;
}

export function now(): number {
  return Date.now() + serverOffsetMs + devOffsetMs;
}

/** Re-render every `tickMs` (default 1 s) with the current corrected time. */
export function useNow(tickMs = 1000): number {
  const [t, setT] = useState(now);
  useEffect(() => {
    const id = window.setInterval(() => setT(now()), tickMs);
    const onChange = () => setT(now());
    listeners.add(onChange);
    return () => {
      window.clearInterval(id);
      listeners.delete(onChange);
    };
  }, [tickMs]);
  return t;
}
