// Per-device preferences in localStorage, guarded so a blocked or missing store never throws.
const KEY = 'present.prefs';

type Prefs = {
  pending_add?: string; // username from an /add link opened while signed out
  skip_schedule?: boolean; // onboarding: "skip for now"
  install_hint_dismissed?: boolean;
};

function read(): Prefs {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Prefs;
  } catch {
    return {};
  }
}

export const prefs = {
  get<K extends keyof Prefs>(k: K): Prefs[K] {
    return read()[k];
  },
  set<K extends keyof Prefs>(k: K, v: Prefs[K]) {
    try {
      const p = read();
      if (v === undefined) delete p[k];
      else p[k] = v;
      localStorage.setItem(KEY, JSON.stringify(p));
    } catch {
      // storage unavailable: preferences are conveniences only
    }
  },
};
