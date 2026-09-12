import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors, radius, space } from '@/lib/theme';

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

export function H1({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.h1, style]}>{children}</Text>;
}
export function H2({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.h2, style]}>{children}</Text>;
}
export function P({ children, style, numberOfLines }: { children: React.ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  return (
    <Text style={[styles.p, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}
export function Muted({ children, style, numberOfLines }: { children: React.ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  return (
    <Text style={[styles.muted, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

export function Card({ children, style, tone }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; tone?: string }) {
  return <View style={[styles.card, tone ? { borderColor: tone, borderLeftWidth: 4 } : null, style]}>{children}</View>;
}

export function Row({ children, style, gap = space.sm }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[styles.row, { gap }, style]}>{children}</View>;
}

export function Pill({ label, color = colors.muted, style }: { label: string; color?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.pill, { borderColor: color }, style]}>
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

type ButtonProps = PressableProps & {
  title: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  loading?: boolean;
  size?: 'md' | 'lg' | 'sm';
  style?: StyleProp<ViewStyle>;
};

export function Button({ title, variant = 'primary', loading, size = 'md', style, disabled, ...rest }: ButtonProps) {
  const bg =
    variant === 'primary' ? colors.accent
    : variant === 'danger' ? colors.red
    : variant === 'success' ? colors.green
    : variant === 'secondary' ? colors.cardAlt
    : 'transparent';
  const fg = variant === 'primary' || variant === 'success' ? colors.accentText : variant === 'ghost' ? colors.muted : colors.text;
  const pad = size === 'lg' ? 18 : size === 'sm' ? 8 : 14;
  return (
    <Pressable
      {...rest}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, paddingVertical: pad, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        variant === 'ghost' && { borderWidth: 1, borderColor: colors.border },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonText, { color: fg, fontSize: size === 'lg' ? 18 : size === 'sm' ? 13 : 16 }]}>{title}</Text>}
    </Pressable>
  );
}

export function Input(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.faint} {...props} style={[styles.input, props.style]} />;
}

export function Avatar({ name, uri, size = 36 }: { name: string; uri?: string | null; size?: number }) {
  const initials = name
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={{ color: colors.text, fontWeight: '700', fontSize: size * 0.4 }}>{initials || '?'}</Text>
    </View>
  );
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <Text style={styles.error}>{children}</Text>;
}

export function Spacer({ h = space.md }: { h?: number }) {
  return <View style={{ height: h }} />;
}

export function Center({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.center, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  h1: { color: colors.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  h2: { color: colors.text, fontSize: 20, fontWeight: '700' },
  p: { color: colors.text, fontSize: 16, lineHeight: 22 },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: space.md,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  pill: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  button: { borderRadius: radius.md, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontWeight: '700' },
  input: {
    backgroundColor: colors.cardAlt,
    color: colors.text,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: { backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  error: { color: colors.red, marginTop: space.sm, fontSize: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
});
