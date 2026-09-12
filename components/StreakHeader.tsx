import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Muted } from '@/components/ui';
import { colors, radius, space } from '@/lib/theme';

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
    <View style={[styles.wrap, dead && styles.wrapDead]}>
      <View style={{ flex: 1 }}>
        {circleName ? <Muted numberOfLines={1}>{circleName}</Muted> : <Muted>Your circle</Muted>}
        <View style={styles.bigRow}>
          <Text style={styles.emoji}>{dead ? '💀' : '🔥'}</Text>
          <Text style={[styles.big, dead && { color: colors.red }]}>{circleStreak}</Text>
          <Text style={styles.unit}>{circleStreak === 1 ? 'day' : 'days'}</Text>
        </View>
        <Muted>{dead ? 'Circle streak is dead. Rebuild it tomorrow.' : 'Circle streak. Everyone, every class.'}</Muted>
      </View>
      <View style={styles.personal}>
        <Text style={[styles.personalNum, personalStreak <= 0 && { color: colors.red }]}>{personalStreak}</Text>
        <Muted style={{ fontSize: 12 }}>your streak</Muted>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.accent,
    padding: space.lg,
    marginBottom: space.lg,
  },
  wrapDead: { borderColor: colors.red },
  bigRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginVertical: 2 },
  emoji: { fontSize: 36, lineHeight: 44 },
  big: { color: colors.text, fontSize: 48, fontWeight: '900', lineHeight: 52, letterSpacing: -1 },
  unit: { color: colors.muted, fontSize: 16, fontWeight: '600', marginBottom: 8 },
  personal: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardAlt,
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    marginLeft: space.md,
    minWidth: 84,
  },
  personalNum: { color: colors.text, fontSize: 28, fontWeight: '800' },
});
