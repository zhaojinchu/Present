// Present design tokens. The single source of visual truth: every colour, size,
// radius and duration used by a component or screen comes from here.
// Spec and rationale: DESIGN.md.
//
// Scheme "A, light": white ground, greys for hierarchy, a black primary
// button, and one spot colour (ember) reserved for the flame and streak
// numbers. Semantic colours live only inside badges and icons. The camera
// flow is the one dark surface and uses the `capture` palette.

import type { TextStyle } from 'react-native';

// ---------------------------------------------------------------- colour

export const colors = {
  // Surface ladder (elevation = a slightly darker grey, never a shadow)
  bg: '#FFFFFF',
  surface: '#F4F4F6',
  surfaceRaised: '#EAEAEE',
  surfaceOverlay: '#DEDEE4',
  scrim: 'rgba(0,0,0,0.55)',

  // Lines
  border: 'rgba(0,0,0,0.08)',
  borderStrong: 'rgba(0,0,0,0.16)',

  // Text (near-black; hierarchy by opacity, not hue)
  text: '#0A0A0B',
  textSecondary: 'rgba(10,10,11,0.62)',
  textTertiary: 'rgba(10,10,11,0.42)',
  textDisabled: 'rgba(10,10,11,0.28)',
  textInverse: '#FFFFFF',

  // Action colour: the primary button, links, selected checks. Mono.
  accent: '#0A0A0B',
  accentPressed: '#2A2A2F',
  accentSoft: 'rgba(10,10,11,0.08)',
  onAccent: '#FFFFFF',

  // The spot colour. Flame icon, streak numbers, my reaction. Nowhere else.
  ember: '#FF6B1F',
  emberDeep: '#E85F19',
  emberSoft: 'rgba(255,107,31,0.14)',

  // Semantic (darkened for white so text passes contrast)
  success: '#1E9E4A',
  successSoft: 'rgba(30,158,74,0.12)',
  danger: '#DF3327',
  dangerSoft: 'rgba(223,51,39,0.12)',
  warning: '#9A6B00',
  warningSoft: 'rgba(255,190,0,0.20)',
  info: '#0B7BC2',
  infoSoft: 'rgba(11,123,194,0.12)',

  // Legacy aliases (kept so nothing breaks while screens migrate; do not use in new code)
  card: '#F4F4F6',
  cardAlt: '#EAEAEE',
  muted: 'rgba(10,10,11,0.62)',
  faint: 'rgba(10,10,11,0.42)',
  accentText: '#FFFFFF',
  green: '#1E9E4A',
  red: '#DF3327',
  amber: '#9A6B00',
  blue: '#0B7BC2',
  purple: '#7A5AF8',
} as const;

/** The camera, preview and upload screens: the one dark surface in the app. */
export const capture = {
  bg: '#0A0A0B',
  text: '#F2F2F5',
  textSecondary: 'rgba(242,242,245,0.64)',
  surfaceRaised: '#1E1E22',
  scrim: 'rgba(0,0,0,0.55)',
  border: 'rgba(255,255,255,0.08)',
} as const;

/** Deterministic avatar fills: pastel so dark initials stay legible and photos stay the loudest thing. */
export const avatarHues = ['#DADCF8', '#CDEBDF', '#F5D7E6', '#EEE3CC', '#D6E6F2', '#F3DBD3'] as const;

// ---------------------------------------------------------------- spacing

/** 4-point grid. Screen gutter is `space.lg` (16) everywhere. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const gutter = space.lg;

// ---------------------------------------------------------------- radius

/** Four radii and a pill. Inner radius = outer radius minus padding. */
export const radius = {
  sm: 8, // chips, small thumbnails
  md: 12, // buttons, inputs, quote boxes
  lg: 16, // cards, photos inside a padded container
  xl: 20, // edge-to-edge photos, sheets
  pill: 999,
} as const;

// ---------------------------------------------------------------- type

/**
 * System font (SF Pro on iOS, Roboto on Android). Nine named styles; screens
 * never set fontSize directly. Counters use the tabular variants so digits do
 * not jitter while they tick.
 */
export const type = {
  display: { fontSize: 44, lineHeight: 48, fontWeight: '700', letterSpacing: -1.2, fontVariant: ['tabular-nums'] },
  stat: { fontSize: 28, lineHeight: 32, fontWeight: '700', letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  largeTitle: { fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -0.6 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.3 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400' },
  subhead: { fontSize: 15, lineHeight: 20, fontWeight: '400' },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  label: { fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 0.7, textTransform: 'uppercase' },
} as const satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;

// ---------------------------------------------------------------- sizes

export const size = {
  touch: 44,
  buttonSm: 36,
  buttonMd: 44,
  buttonLg: 52,
  input: 52,
  iconSm: 16,
  iconMd: 20,
  iconLg: 24,
  avatarXs: 24,
  avatarSm: 32,
  avatarMd: 40,
  avatarLg: 56,
  avatarXl: 72,
  hairline: 1,
} as const;

// ---------------------------------------------------------------- motion

export const motion = {
  fast: 120, // press feedback
  base: 200, // fades, chip toggles
  slow: 400, // panels, streak counter
  pressScale: 0.97,
} as const;

// ---------------------------------------------------------------- semantic maps

/** Status of an occurrence or forfeit -> badge colour pair. */
export const statusColor: Record<string, string> = {
  pending: colors.textSecondary,
  checked_in: colors.success,
  skipped: colors.danger,
  excused: colors.info,
  owed: colors.warning,
  paid: colors.success,
  voided: colors.textTertiary,
};

export const statusSoft: Record<string, string> = {
  pending: colors.surfaceRaised,
  checked_in: colors.successSoft,
  skipped: colors.dangerSoft,
  excused: colors.infoSoft,
  owed: colors.warningSoft,
  paid: colors.successSoft,
  voided: colors.surfaceRaised,
};

export const statusLabel: Record<string, string> = {
  pending: 'Pending',
  checked_in: 'Checked in',
  skipped: 'Skipped',
  excused: 'Excused',
  owed: 'Owed',
  paid: 'Paid',
  voided: 'Voided',
};
