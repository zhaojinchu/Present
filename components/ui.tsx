import { Image } from 'expo-image';
import React, { useState } from 'react';
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
import { colors, fonts, radius, space, toneFill, type as typeScale } from '@/lib/theme';

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

export function Label({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.label, style]}>{children}</Text>;
}

export function Card({
  children,
  style,
  tone,
  padded = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: string;
  padded?: boolean;
}) {
  return (
    <View style={[styles.card, !padded && styles.cardFlush, tone ? toneFill(tone) : null, style]}>{children}</View>
  );
}

export function Row({ children, style, gap = space.sm }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[styles.row, { gap }, style]}>{children}</View>;
}

export function Pill({ label, color = colors.muted, style }: { label: string; color?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.pill, toneFill(color), style]}>
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
    : variant === 'secondary' ? colors.card
    : 'transparent';
  const fg =
    variant === 'primary' ? colors.accentText
    : variant === 'success' ? colors.accentText
    : variant === 'danger' ? colors.white
    : variant === 'ghost' ? colors.muted
    : colors.text;
  const pad = size === 'lg' ? 16 : size === 'sm' ? 9 : 13;
  return (
    <Pressable
      {...rest}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, paddingVertical: pad, opacity: disabled ? 0.42 : pressed ? 0.82 : 1 },
        variant === 'secondary' && { borderWidth: 1, borderColor: colors.borderStrong },
        variant === 'ghost' && { borderWidth: 0 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.buttonText, { color: fg, fontSize: size === 'lg' ? 17 : size === 'sm' ? 14 : 16 }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Input(props: TextInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={colors.faint}
      {...props}
      onFocus={(e) => {
        setFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        props.onBlur?.(e);
      }}
      style={[styles.input, focused && styles.inputFocused, props.style]}
    />
  );
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
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <Text style={{ color: colors.text, fontFamily: fonts.bold, fontSize: size * 0.36 }}>{initials || '?'}</Text>
      )}
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
  h1: { color: colors.text, ...typeScale.h1 },
  h2: { color: colors.text, ...typeScale.h2 },
  p: { color: colors.text, ...typeScale.body },
  muted: { color: colors.muted, ...typeScale.caption },
  label: { color: colors.muted, ...typeScale.micro },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: space.lg,
    marginBottom: space.md,
  },
  cardFlush: { padding: 0, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center' },
  pill: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  pillText: { fontSize: 13, fontFamily: fonts.bold },
  button: { borderRadius: radius.md, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontFamily: fonts.bold },
  input: {
    backgroundColor: colors.card,
    color: colors.text,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    fontFamily: fonts.regular,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputFocused: { borderColor: colors.text },
  avatar: {
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  error: { color: colors.red, marginTop: space.sm, fontSize: 14, fontFamily: fonts.bold },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
});
