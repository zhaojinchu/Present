import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts, radius } from '@/lib/theme';

/** "8 day streak" chip. A dead streak renders in red. */
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
  const fontSize = size === 'lg' ? 22 : size === 'sm' ? 13 : 15;
  return (
    <View style={[styles.badge, dead && styles.dead, style]}>
      <Text style={[styles.text, { fontSize }, dead && { color: colors.red }]}>
        {value}
        {label ? ` ${label}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignSelf: 'flex-start',
  },
  dead: { backgroundColor: colors.redSoft, borderColor: colors.red },
  text: { color: colors.text, fontFamily: fonts.black },
});
