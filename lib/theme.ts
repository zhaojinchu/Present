// One dark palette. The demo runs on a projector: high contrast, big type.
export const colors = {
  bg: '#0f0f12',
  card: '#1a1a20',
  cardAlt: '#22222a',
  border: '#2a2a33',
  text: '#f5f5f7',
  muted: '#9a9aa5',
  faint: '#5c5c66',
  accent: '#f97316',
  accentText: '#0f0f12',
  green: '#22c55e',
  red: '#ef4444',
  amber: '#f59e0b',
  blue: '#60a5fa',
  purple: '#a78bfa',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 };

export const statusColor: Record<string, string> = {
  pending: colors.muted,
  checked_in: colors.green,
  skipped: colors.red,
  excused: colors.blue,
  owed: colors.amber,
  paid: colors.green,
  voided: colors.faint,
};
