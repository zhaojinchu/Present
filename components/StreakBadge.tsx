import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius } from '@/lib/theme';

/** "🔥 8" pill. A dead streak renders "💀 0" in red. */
export function StreakBadge({
  value,
  label,
  size = 'md',
  style,
}: {
  value: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
}) {
  const dead = value <= 0;
  const fontSize = size === 'lg' ? 26 : size === 'sm' ? 13 : 16;
  return (
    <View style={[styles.badge, dead && styles.dead, style]}>
      <Text style={[styles.text, { fontSize }, dead && { color: colors.red }]}>
        {dead ? '💀' : '🔥'} {value}
        {label ? ` ${label}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  dead: { borderColor: colors.red, backgroundColor: '#2a1214' },
  text: { color: colors.text, fontWeight: '800' },
});
