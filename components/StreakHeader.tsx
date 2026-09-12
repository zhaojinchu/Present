import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, space } from '@/lib/theme';

export function StreakHeader({
  circleStreak,
  personalStreak,
  circleName,
}: {
  circleStreak: number;
  personalStreak: number;
  circleName?: string | null;
}) {
  const dead = circleStreak <= 0;
  return (
    <View style={styles.wrap}>
      <Text style={styles.wordmark}>Present.</Text>
      <Text style={[styles.meta, dead && { color: colors.red }]}>
        {circleName ? `${circleName}  ·  ` : ''}
        {dead ? '💀' : '🔥'} {circleStreak}
        {'  ·  '}
        you {personalStreak}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: space.sm, paddingBottom: space.lg },
  wordmark: { color: colors.text, fontSize: 28, fontFamily: fonts.black },
  meta: { color: colors.muted, fontSize: 14, fontFamily: fonts.bold, marginTop: 6 },
});
