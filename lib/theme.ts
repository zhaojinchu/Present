// Newsprint. Cream paper, taupe ink, terracotta only when something is wrong.
// Type is Lato, the Slack UI face.

export const fonts = {
  regular: 'Lato_400Regular',
  italic: 'Lato_400Regular_Italic',
  bold: 'Lato_700Bold',
  black: 'Lato_900Black',
} as const;

export const colors = {
  bg: '#F7F0E3',
  bgElevated: '#FFFBF2',
  card: '#FFFBF2',
  cardAlt: '#EEE4D2',
  border: '#E4D7C0',
  borderStrong: '#D4C4A8',
  text: '#4A4036',
  muted: '#8F8272',
  faint: '#B5A894',
  accent: '#4A4036',
  accentMuted: '#8F8272',
  accentSoft: 'rgba(74, 64, 54, 0.08)',
  accentText: '#FFF8EC',
  green: '#4A4036',
  greenSoft: 'rgba(74, 64, 54, 0.08)',
  red: '#C9846E',
  redSoft: 'rgba(201, 132, 110, 0.16)',
  amber: '#C9846E',
  amberSoft: 'rgba(201, 132, 110, 0.16)',
  blue: '#8F8272',
  blueSoft: 'rgba(143, 130, 114, 0.12)',
  purple: '#8F8272',
  overlay: 'rgba(74, 64, 54, 0.50)',
  overlayHeavy: 'rgba(74, 64, 54, 0.70)',
  white: '#FFFFFF',
  like: '#C9846E',
  igMuted: '#8F8272',
  igHairline: '#E4D7C0',
  igBlue: '#4A4036',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 36 };
export const radius = { sm: 10, md: 14, lg: 20, xl: 24, pill: 999 };

export const type = {
  display: { fontSize: 72, fontFamily: fonts.black, letterSpacing: -1.2, lineHeight: 72 },
  h1: { fontSize: 32, fontFamily: fonts.black, lineHeight: 38 },
  h2: { fontSize: 18, fontFamily: fonts.bold, lineHeight: 24 },
  body: { fontSize: 16, fontFamily: fonts.regular, lineHeight: 22 },
  caption: { fontSize: 13, fontFamily: fonts.regular, lineHeight: 18 },
  micro: { fontSize: 13, fontFamily: fonts.bold },
};

export const statusColor: Record<string, string> = {
  pending: colors.muted,
  checked_in: colors.green,
  skipped: colors.red,
  excused: colors.blue,
  owed: colors.amber,
  paid: colors.green,
  voided: colors.faint,
};

function isSignal(color: string): boolean {
  return color === colors.red || color === colors.amber || color === colors.like;
}

function isInk(color: string): boolean {
  return color === colors.accent || color === colors.green || color === colors.text || color === colors.igBlue;
}

function isMutedInk(color: string): boolean {
  return color === colors.blue || color === colors.muted || color === colors.purple || color === colors.accentMuted;
}

/** Soft wash for a status color. Unknown colors get nothing. */
export function toneFill(color?: string): { backgroundColor?: string } {
  if (!color) return {};
  if (isSignal(color)) return { backgroundColor: colors.redSoft };
  if (isInk(color)) return { backgroundColor: colors.accentSoft };
  if (isMutedInk(color)) return { backgroundColor: colors.blueSoft };
  if (color === colors.faint) return { backgroundColor: colors.cardAlt };
  return {};
}

export function toneWash(color?: string): string {
  if (!color) return colors.cardAlt;
  if (isSignal(color)) return colors.redSoft;
  if (isInk(color)) return colors.accentSoft;
  if (isMutedInk(color)) return colors.blueSoft;
  return colors.cardAlt;
}
