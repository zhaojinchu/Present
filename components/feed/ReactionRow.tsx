import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { toggleReaction } from '@/lib/api/circle';
import { useCircleState } from '@/lib/circleState';
import { REACTION_EMOJI } from '@/lib/config';
import { colors, radius } from '@/lib/theme';
import type { Reaction } from '@/lib/types';

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
          {r.count > 0 ? <Text style={[styles.count, r.mine && { color: colors.accent }]}>{r.count}</Text> : null}
        </Pressable>
      ))}
      {!expanded ? (
        <Pressable onPress={() => setExpanded(true)} style={({ pressed }) => [styles.pill, styles.plus, pressed && { opacity: 0.7 }]}>
          <Text style={styles.plusText}>+</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardAlt,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  mine: { borderColor: colors.accent, backgroundColor: '#2b1d10' },
  emoji: { fontSize: 15 },
  count: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  plus: { paddingHorizontal: 12 },
  plusText: { color: colors.muted, fontSize: 15, fontWeight: '700', lineHeight: 18 },
});
