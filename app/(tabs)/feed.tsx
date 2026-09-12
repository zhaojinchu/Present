import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { FeedCard } from '@/components/feed/FeedCard';
import { StreakBadge } from '@/components/StreakBadge';
import { Center, H2, Muted, P, Screen } from '@/components/ui';
import { useCircleState } from '@/lib/circleState';
import { useNow } from '@/lib/clock';
import { colors, space } from '@/lib/theme';
import { dayKey, dayLabel } from '@/lib/time';
import type { FeedEvent } from '@/lib/types';

export default function FeedScreen() {
  const { state, live, refresh, loading } = useCircleState();
  const now = useNow(30_000);
  const nowMs = now.getTime();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh({ maintain: true });
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const sections = useMemo(() => {
    if (!state) return [];
    const groups = new Map<string, FeedEvent[]>();
    for (const e of state.feed) {
      const k = dayKey(e.created_at);
      const arr = groups.get(k);
      if (arr) arr.push(e);
      else groups.set(k, [e]);
    }
    return [...groups.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([k, data]) => ({ key: k, title: dayLabel(data[0].created_at, nowMs), data }));
  }, [state, nowMs]);

  if (!state || !state.circle) {
    return (
      <Screen>
        <Center>
          <Muted>{loading ? 'Loading your circle…' : 'You are not in a circle yet.'}</Muted>
        </Center>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <H2>{state.circle.name}</H2>
          <View style={styles.liveRow}>
            <View style={[styles.dot, { backgroundColor: live ? colors.green : colors.muted }]} />
            <Muted style={{ fontSize: 12 }}>{live ? 'live' : 'syncing'}</Muted>
          </View>
        </View>
        <StreakBadge value={state.circle_streak} label="day circle streak" />
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <FeedCard
            event={item}
            me={state.me}
            members={state.members}
            forfeits={state.forfeits}
            reactions={state.reactions}
            nowMs={nowMs}
          />
        )}
        renderSectionHeader={({ section }) => <Text style={styles.sectionHeader}>{section.title}</Text>}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        ListEmptyComponent={
          <Center style={{ paddingTop: 80 }}>
            <P style={{ textAlign: 'center' }}>Nothing here yet.</P>
            <Muted style={{ textAlign: 'center', marginTop: 8 }}>
              Check-ins, skips and forfeits from {state.circle.name} will show up here as they happen.
            </Muted>
          </Center>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  list: { paddingHorizontal: space.lg, paddingBottom: 40 },
  sectionHeader: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: space.lg,
    marginBottom: space.sm,
  },
});
