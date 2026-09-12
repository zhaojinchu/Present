import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { toggleReaction } from '@/lib/api/circle';
import { useCircleState } from '@/lib/circleState';
import { REACTION_EMOJI } from '@/lib/config';
import { colors, radius, space, type } from '@/lib/theme';
import type { Reaction } from '@/lib/types';

/** Emoji reaction pills. Only reactions with a count show until "+" expands the full set. */
export function ReactionRow({ eventId, reactions, me }: { eventId: string; reactions: Reaction[]; me: string }) {
  const { refresh } = useCircleState();
  const [expanded, setExpanded] = useState(false);
  // emoji -> whether *I* have it, overriding the server until the next refresh lands
  const [override, setOverride] = useState<Record<string, boolean>>({});

  const rows = useMemo(() => {
    const forEvent = reactions.filter((r) => r.feed_event_id === eventId);
    return REACTION_EMOJI.map((emoji) => {
      const serverMine = forEvent.some((r) => r.user_id === me && r.emoji === emoji);
      const serverCount = forEvent.filter((r) => r.emoji === emoji).length;
      const mine = override[emoji] ?? serverMine;
      const count = serverCount + (mine && !serverMine ? 1 : 0) - (!mine && serverMine ? 1 : 0);
      return { emoji, mine, count };
    });
  }, [reactions, eventId, me, override]);

  const visible = expanded ? rows : rows.filter((r) => r.count > 0);

  const onPress = async (emoji: string, mine: boolean) => {
    setOverride((o) => ({ ...o, [emoji]: !mine }));
    try {
      await toggleReaction(eventId, emoji);
      await refresh();
    } catch {
      // revert on failure
    } finally {
      setOverride((o) => {
        const next = { ...o };
        delete next[emoji];
        return next;
      });
    }
  };

  return (
    <View style={styles.row}>
      {visible.map((r) => (
        <Pressable
          key={r.emoji}
          onPress={() => onPress(r.emoji, r.mine)}
          style={({ pressed }) => [styles.pill, r.mine && styles.mine, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.emoji}>{r.emoji}</Text>
          {r.count > 0 ? <Text style={[styles.count, r.mine && { color: colors.emberDeep }]}>{r.count}</Text> : null}
        </Pressable>
      ))}
      {!expanded ? (
        <Pressable onPress={() => setExpanded(true)} hitSlop={6} style={({ pressed }) => [styles.pill, styles.plus, pressed && { opacity: 0.7 }]} accessibilityLabel="Add reaction">
          <Ionicons name="add" size={16} color={colors.textTertiary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: space.md },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    height: 30,
  },
  mine: { backgroundColor: colors.emberSoft },
  emoji: { fontSize: 15 },
  count: { ...type.caption, color: colors.textSecondary, fontWeight: '600', fontVariant: ['tabular-nums'] },
  plus: { paddingHorizontal: 9 },
});
