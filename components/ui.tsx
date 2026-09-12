// Design-system primitives. Screens compose these; they never set fontSize,
// hex colours or radii themselves. Tokens live in lib/theme.ts, spec in DESIGN.md.

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { avatarHues, capture, colors, motion, radius, size, space, type, type TypeVariant } from '@/lib/theme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

// ---------------------------------------------------------------- layout

export function Screen({
  children,
  style,
  padded = true,
  edges = ['top', 'left', 'right'],
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  /** Screens under a native header should pass ['left', 'right'] to avoid a double top inset. */
  edges?: Edge[];
}) {
  return (
    <SafeAreaView style={[styles.screen, padded && { paddingHorizontal: space.lg }, style]} edges={edges}>
      {children}
    </SafeAreaView>
  );
}

export function Row({ children, style, gap = space.sm }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[styles.row, { gap }, style]}>{children}</View>;
}

export function Spacer({ h = space.md }: { h?: number }) {
  return <View style={{ height: h }} />;
}

export function Center({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.center, style]}>{children}</View>;
}

/** 1px hairline. `inset` starts it at the text column of a list row (gutter + avatar + gap). */
export function Divider({ inset = 0, style }: { inset?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.divider, { marginLeft: inset }, style]} />;
}

// ---------------------------------------------------------------- text

type Tone = 'primary' | 'secondary' | 'tertiary' | 'disabled' | 'accent' | 'success' | 'danger' | 'warning' | 'info' | 'inverse';

const toneColor: Record<Tone, string> = {
  primary: colors.text,
  secondary: colors.textSecondary,
  tertiary: colors.textTertiary,
  disabled: colors.textDisabled,
  accent: colors.accent,
  success: colors.success,
  danger: colors.danger,
  warning: colors.warning,
  info: colors.info,
  inverse: colors.textInverse,
};

export interface TxtProps extends TextProps {
  variant?: TypeVariant;
  tone?: Tone;
  weight?: TextStyle['fontWeight'];
  align?: TextStyle['textAlign'];
  /** Tabular numerals; on by default for the display/stat variants. */
  tabular?: boolean;
  children?: React.ReactNode;
}

/** The one text component. `<Txt variant="headline" tone="secondary">`. */
export function Txt({ variant = 'body', tone = 'primary', weight, align, tabular, style, children, ...rest }: TxtProps) {
  return (
    <Text
      {...rest}
      style={[
        type[variant],
        { color: toneColor[tone] },
        weight ? { fontWeight: weight } : null,
        align ? { textAlign: align } : null,
        tabular ? { fontVariant: ['tabular-nums'] } : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

// Thin wrappers kept for existing call sites. New code uses <Txt>.
export function H1(props: TxtProps) {
  return <Txt variant="largeTitle" {...props} />;
}
export function H2(props: TxtProps) {
  return <Txt variant="title" {...props} />;
}
export function P(props: TxtProps) {
  return <Txt variant="body" {...props} />;
}
export function Muted(props: TxtProps) {
  return <Txt variant="subhead" tone="secondary" {...props} />;
}

/** Uppercase tracked section label, e.g. "TODAY", "MEMBERS". */
export function SectionLabel({ children, style, action }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; action?: React.ReactNode }) {
  return (
    <View style={[styles.sectionLabel, style]}>
      <Txt variant="label" tone="tertiary">
        {children}
      </Txt>
      {action}
    </View>
  );
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <Txt variant="footnote" tone="danger" style={{ marginTop: space.sm }}>
      {children}
    </Txt>
  );
}

// ---------------------------------------------------------------- icon

export function Icon({ name, size: s = size.iconMd, color = colors.text, style }: { name: IconName; size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  return <Ionicons name={name} size={s} color={color} style={style} />;
}

/** Icon inside a tinted disc. `tone` picks the soft background + icon colour pair. */
export function IconBadge({
  name,
  tone = 'neutral',
  size: s = 40,
  style,
}: {
  name: IconName;
  tone?: 'neutral' | 'accent' | 'success' | 'danger' | 'warning' | 'info';
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const pair = {
    neutral: [colors.surfaceRaised, colors.textSecondary],
    accent: [colors.accentSoft, colors.accent],
    success: [colors.successSoft, colors.success],
    danger: [colors.dangerSoft, colors.danger],
    warning: [colors.warningSoft, colors.warning],
    info: [colors.infoSoft, colors.info],
  }[tone];
  return (
    <View style={[{ width: s, height: s, borderRadius: s / 2, backgroundColor: pair[0], alignItems: 'center', justifyContent: 'center' }, style]}>
      <Ionicons name={name} size={Math.round(s * 0.5)} color={pair[1]} />
    </View>
  );
}

// ---------------------------------------------------------------- surfaces

/** Flat raised surface. No border, no coloured edge. Use sparingly: hero blocks and grouped lists. */
export function Card({ children, style, padded = true }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  return <View style={[styles.card, padded && { padding: space.lg }, style]}>{children}</View>;
}

/** Inset grouped list container: children are rows; hairlines go between them. */
export function Group({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[styles.group, style]}>
      {items.map((child, i) => (
        <React.Fragment key={i}>
          {i > 0 ? <Divider inset={space.lg} /> : null}
          {child}
        </React.Fragment>
      ))}
    </View>
  );
}

/** Standard list row: leading | title + subtitle | trailing (+ chevron when onPress). */
export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  onPress,
  chevron = !!onPress,
  destructive,
  style,
}: {
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  destructive?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const body = (
    <>
      {leading ? <View style={styles.rowLeading}>{leading}</View> : null}
      <View style={styles.rowBody}>
        {typeof title === 'string' ? (
          <Txt variant="body" tone={destructive ? 'danger' : 'primary'} numberOfLines={1}>
            {title}
          </Txt>
        ) : (
          title
        )}
        {subtitle ? (
          typeof subtitle === 'string' ? (
            <Txt variant="footnote" tone="secondary" numberOfLines={1}>
              {subtitle}
            </Txt>
          ) : (
            subtitle
          )
        ) : null}
      </View>
      {trailing ? <View style={styles.rowTrailing}>{trailing}</View> : null}
      {chevron ? <Ionicons name="chevron-forward" size={size.iconMd} color={colors.textTertiary} /> : null}
    </>
  );
  if (!onPress) return <View style={[styles.listRow, style]}>{body}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.listRow, pressed && styles.pressed, style]}>
      {body}
    </Pressable>
  );
}

// ---------------------------------------------------------------- badges & chips

type BadgeTone = 'neutral' | 'accent' | 'success' | 'danger' | 'warning' | 'info';

const badgePair: Record<BadgeTone, [string, string]> = {
  neutral: [colors.surfaceRaised, colors.textSecondary],
  accent: [colors.accentSoft, colors.accent],
  success: [colors.successSoft, colors.success],
  danger: [colors.dangerSoft, colors.danger],
  warning: [colors.warningSoft, colors.warning],
  info: [colors.infoSoft, colors.info],
};

/** Soft-tinted status badge. Sentence case, no border. */
export function Badge({ label, tone = 'neutral', icon, style }: { label: string; tone?: BadgeTone; icon?: IconName; style?: StyleProp<ViewStyle> }) {
  const [bg, fg] = badgePair[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      {icon ? <Ionicons name={icon} size={12} color={fg} style={{ marginRight: 4 }} /> : null}
      <Text style={[type.caption, { color: fg, fontWeight: '600' }]}>{label}</Text>
    </View>
  );
}

/** Legacy alias: old call sites passed a colour; map the common ones to a tone. */
export function Pill({ label, color, style }: { label: string; color?: string; style?: StyleProp<ViewStyle> }) {
  const tone: BadgeTone =
    color === colors.success ? 'success'
    : color === colors.danger ? 'danger'
    : color === colors.warning ? 'warning'
    : color === colors.info ? 'info'
    : color === colors.accent ? 'accent'
    : 'neutral';
  return <Badge label={label} tone={tone} style={style} />;
}

/** Selectable chip (days, hours, buildings). Selected = inverted (light fill, dark text); accent stays reserved. */
export function Chip({ label, selected, onPress, style }: { label: string; selected?: boolean; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={2}
      style={({ pressed }) => [styles.chip, selected && styles.chipOn, pressed && { opacity: 0.8 }, style]}
    >
      <Text style={[type.subhead, { fontWeight: '600', color: selected ? colors.textInverse : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

/** Streak count with a flame. Alive = ember; dead = outline flame, red number. */
export function StreakChip({ value, size: s = 'md', style }: { value: number; size?: 'sm' | 'md'; style?: StyleProp<ViewStyle> }) {
  const dead = value <= 0;
  const fg = dead ? colors.danger : colors.emberDeep;
  return (
    <View style={[styles.streakChip, s === 'sm' && styles.streakChipSm, style]}>
      <Ionicons name={dead ? 'flame-outline' : 'flame'} size={s === 'sm' ? 12 : 14} color={fg} />
      <Text style={[s === 'sm' ? type.caption : type.subhead, { color: fg, fontWeight: '700', fontVariant: ['tabular-nums'] }]}>{value}</Text>
    </View>
  );
}

// ---------------------------------------------------------------- stat

/** Big tabular number with a tracked uppercase label under it. */
export function Stat({
  value,
  label,
  size: s = 'md',
  tone = 'primary',
  icon,
  iconColor,
  align = 'flex-start',
  style,
}: {
  value: React.ReactNode;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  tone?: Tone;
  icon?: IconName;
  /** Defaults to the tone colour; the streak flame passes the accent. */
  iconColor?: string;
  align?: ViewStyle['alignItems'];
  style?: StyleProp<ViewStyle>;
}) {
  const variant: TypeVariant = s === 'lg' ? 'display' : s === 'md' ? 'stat' : 'title';
  return (
    <View style={[{ alignItems: align }, style]}>
      <View style={[styles.row, { gap: s === 'lg' ? 6 : 4 }]}>
        {icon ? <Ionicons name={icon} size={s === 'lg' ? 30 : s === 'md' ? 20 : 16} color={iconColor ?? toneColor[tone]} /> : null}
        <Txt variant={variant} tone={tone} tabular>
          {value}
        </Txt>
      </View>
      <Txt variant="label" tone="tertiary" style={{ marginTop: 2 }}>
        {label}
      </Txt>
    </View>
  );
}

// ---------------------------------------------------------------- button

type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive' | 'inverse' | 'ghost' | 'danger' | 'success';

type ButtonProps = Omit<PressableProps, 'style'> & {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';
  icon?: IconName;
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
};

const buttonVariant: Record<'primary' | 'secondary' | 'tertiary' | 'destructive' | 'inverse', { bg: string; fg: string; pressedBg: string }> = {
  primary: { bg: colors.accent, fg: colors.onAccent, pressedBg: colors.accentPressed },
  secondary: { bg: colors.surfaceRaised, fg: colors.text, pressedBg: colors.surfaceOverlay },
  tertiary: { bg: 'transparent', fg: colors.textSecondary, pressedBg: colors.surface },
  destructive: { bg: colors.dangerSoft, fg: colors.danger, pressedBg: 'rgba(223,51,39,0.2)' },
  // White on the dark capture surfaces (camera preview bar).
  inverse: { bg: capture.text, fg: capture.bg, pressedBg: '#D6D6DB' },
};

function normalizeVariant(v: ButtonVariant): keyof typeof buttonVariant {
  if (v === 'ghost') return 'tertiary';
  if (v === 'danger') return 'destructive';
  if (v === 'success') return 'primary';
  return v;
}

export function Button({ title, variant = 'primary', loading, size: s = 'md', icon, haptic, style, disabled, onPress, ...rest }: ButtonProps) {
  const v = buttonVariant[normalizeVariant(variant)];
  const scale = React.useRef(new Animated.Value(1)).current;
  const height = s === 'lg' ? size.buttonLg : s === 'sm' ? size.buttonSm : size.buttonMd;
  const textStyle = s === 'lg' ? type.headline : s === 'sm' ? { ...type.subhead, fontWeight: '600' as const } : type.headline;
  const animate = (to: number) =>
    Animated.timing(scale, { toValue: to, duration: motion.fast, useNativeDriver: true }).start();
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        {...rest}
        accessibilityRole="button"
        disabled={disabled || loading}
        onPressIn={() => animate(motion.pressScale)}
        onPressOut={() => animate(1)}
        onPress={(e) => {
          if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onPress?.(e);
        }}
        style={({ pressed }) => [
          styles.button,
          { height, backgroundColor: pressed ? v.pressedBg : v.bg, opacity: disabled ? 0.4 : 1 },
          s === 'sm' && { paddingHorizontal: space.md },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={v.fg} />
        ) : (
          <View style={[styles.row, { gap: 6 }]}>
            {icon ? <Ionicons name={icon} size={s === 'sm' ? 16 : 18} color={v.fg} /> : null}
            <Text style={[textStyle, { color: v.fg }]}>{title}</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

/** 44pt circular icon button (nav bars, camera overlay). */
export function IconButton({
  name,
  onPress,
  color = colors.text,
  bg = colors.surfaceRaised,
  size: s = size.touch,
  iconSize = size.iconLg,
  accessibilityLabel,
  disabled,
  style,
}: {
  name: IconName;
  onPress?: () => void;
  color?: string;
  bg?: string;
  size?: number;
  iconSize?: number;
  accessibilityLabel?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        { width: s, height: s, borderRadius: s / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
        style,
      ]}
    >
      <Ionicons name={name} size={iconSize} color={color} />
    </Pressable>
  );
}

// ---------------------------------------------------------------- input

export function Input({ style, ...props }: TextInputProps) {
  return <TextInput placeholderTextColor={colors.textTertiary} selectionColor={colors.accent} {...props} style={[styles.input, style]} />;
}

/** Label above an input. */
export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Txt variant="footnote" tone="secondary" weight="600">
        {label}
      </Txt>
      {children}
      {hint ? (
        <Txt variant="footnote" tone="tertiary">
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

/** iOS-style segmented control. */
export function Segmented<T extends string>({ options, value, onChange, style }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.segments, style]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} style={[styles.segment, on && styles.segmentOn]}>
            <Text style={[type.subhead, { fontWeight: '600', color: on ? colors.text : colors.textSecondary }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------- avatar

function hueFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return avatarHues[h % avatarHues.length];
}

export function Avatar({ name, uri, size: s = size.avatarMd, style }: { name: string; uri?: string | null; size?: number; style?: StyleProp<ViewStyle> }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <View style={[styles.avatar, { width: s, height: s, borderRadius: s / 2, backgroundColor: hueFor(name) }, style]}>
      <Text style={{ color: colors.text, fontWeight: '600', fontSize: Math.round(s * 0.4), letterSpacing: s >= 56 ? -0.5 : 0 }}>{initials || '?'}</Text>
    </View>
  );
}

/** Overlapping avatars, e.g. "who is there". */
export function AvatarStack({ people, size: s = size.avatarXs, max = 4 }: { people: { name: string; uri?: string | null }[]; size?: number; max?: number }) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <View style={[styles.row, { flexDirection: 'row' }]}>
      {shown.map((p, i) => (
        <Avatar key={`${p.name}-${i}`} name={p.name} uri={p.uri} size={s} style={[styles.stacked, i > 0 && { marginLeft: -Math.round(s * 0.3) }]} />
      ))}
      {rest > 0 ? (
        <View style={[styles.avatar, styles.stacked, { width: s, height: s, borderRadius: s / 2, backgroundColor: colors.surfaceOverlay, marginLeft: -Math.round(s * 0.3) }]}>
          <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: Math.round(s * 0.38) }}>+{rest}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------- empty state

export function EmptyState({ icon, title, message, action, style }: { icon: IconName; title: string; message?: string; action?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.empty, style]}>
      <IconBadge name={icon} size={56} />
      <Txt variant="headline" align="center" style={{ marginTop: space.md }}>
        {title}
      </Txt>
      {message ? (
        <Txt variant="subhead" tone="secondary" align="center" style={{ marginTop: space.xs, maxWidth: 300 }}>
          {message}
        </Txt>
      ) : null}
      {action ? <View style={{ marginTop: space.lg, alignSelf: 'stretch' }}>{action}</View> : null}
    </View>
  );
}

// ---------------------------------------------------------------- brand

/** PLACEHOLDER mark until the logo is chosen: a black tile with a white P. Same drawing as the placeholder app icon. */
export function Mark({ size: s = 56, color = colors.accent }: { size?: number; color?: string }) {
  return (
    <View style={{ width: s, height: s, borderRadius: Math.round(s * 0.28), borderCurve: 'continuous', backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.textInverse, fontSize: Math.round(s * 0.58), lineHeight: Math.round(s * 0.7), fontWeight: '700', letterSpacing: -s * 0.02 }}>P</Text>
    </View>
  );
}

export function Wordmark({ size: s = 28 }: { size?: number }) {
  return (
    <View style={[styles.row, { gap: Math.round(s * 0.35) }]}>
      <Mark size={s} />
      <Text style={{ color: colors.text, fontSize: s, lineHeight: Math.round(s * 1.15), fontWeight: '700', letterSpacing: -s * 0.03 }}>Present</Text>
    </View>
  );
}

// ---------------------------------------------------------------- styles

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: 'row', alignItems: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.xl,
    marginBottom: space.sm,
  },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderCurve: 'continuous', overflow: 'hidden' },
  group: { backgroundColor: colors.surface, borderRadius: radius.lg, borderCurve: 'continuous', overflow: 'hidden' },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    gap: space.md,
  },
  rowLeading: { alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, gap: 2 },
  rowTrailing: { alignItems: 'flex-end', justifyContent: 'center' },
  pressed: { backgroundColor: colors.surfaceRaised },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  chip: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.text },
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    height: 28,
    alignSelf: 'flex-start',
  },
  streakChipSm: { height: 22, paddingHorizontal: 7 },
  button: {
    borderRadius: radius.md,
    borderCurve: 'continuous',
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    height: size.input,
    backgroundColor: colors.surfaceRaised,
    color: colors.text,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    paddingHorizontal: space.lg,
    ...type.body,
  },
  segments: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    padding: 3,
  },
  segment: { flex: 1, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm + 1 },
  segmentOn: { backgroundColor: colors.surfaceOverlay },
  avatar: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  stacked: { borderWidth: 2, borderColor: colors.bg },
  empty: { alignItems: 'center', paddingVertical: space.xxxl, paddingHorizontal: space.xl },
});
