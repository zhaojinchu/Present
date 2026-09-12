import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AvatarStack, Card, Divider, Row, Stat, Txt } from '@/components/ui';
import { colors, space } from '@/lib/theme';

/**
 * The Today hero: circle streak big, personal streak beside it, and who has
 * checked in today underneath. No border, no emoji; a dead streak turns the
 * number red and swaps the flame for its outline.
 */
export function StreakHeader({
  circleStreak,
  personalStreak,
  circleName,
  present = [],
  total = 0,
}: {
  circleStreak: number;
  personalStreak: number;
  circleName?: string | null;
  /** Members who have checked in today. */
  present?: { name: string; uri?: string | null }[];
  /** Members who have a class today. */
  total?: number;
}) {
  const dead = circleStreak <= 0;
  return (
    <Card style={styles.card}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Stat
          size="lg"
          value={circleStreak}
          label={dead ? 'Streak lost' : 'Circle streak'}
          icon={dead ? 'flame-outline' : 'flame'}
          iconColor={dead ? colors.danger : colors.ember}
          tone={dead ? 'danger' : 'primary'}
        />
        <Stat size="md" value={personalStreak} label="Your streak" tone={personalStreak <= 0 ? 'danger' : 'primary'} align="flex-end" />
      </Row>
      <Divider style={{ marginVertical: space.md }} />
      <Row style={{ justifyContent: 'space-between' }} gap={space.md}>
        <Row gap={space.sm} style={{ flex: 1 }}>
          {present.length > 0 ? <AvatarStack people={present} /> : null}
          <Txt variant="footnote" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>
            {total === 0 ? 'No classes in the circle today' : `${present.length} of ${total} checked in today`}
          </Txt>
        </Row>
        {circleName ? (
          <Txt variant="footnote" tone="tertiary" numberOfLines={1}>
            {circleName}
          </Txt>
        ) : null}
      </Row>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: space.lg },
});

export const _unused = View;
