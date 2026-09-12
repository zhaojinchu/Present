import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { FeedCard } from '@/components/feed/FeedCard';
import { Center, Divider, EmptyState, Row, Screen, StreakChip, Txt } from '@/components/ui';
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

  // Explanations render as a quote under their skip, so they leave the list
  // when the skip is present. Keyed by the skip's occurrence; ref_id as a fallback.
  const { sections, explanations } = useMemo(() => {
    const explanations = new Map<string, FeedEvent>();
    const skipsSeen = new Set<string>();
    if (!state) return { sections: [], explanations };
    for (const e of state.feed) {
      if (e.type === 'skip') {
        if (e.occurrence_id) skipsSeen.add(e.occurrence_id);
        if (e.ref_id) skipsSeen.add(e.ref_id);
      }
    }
    const list: FeedEvent[] = [];
    for (const e of state.feed) {
      if (e.type === 'explanation') {
        const key = e.occurrence_id && skipsSeen.has(e.occurrence_id) ? e.occurrence_id : e.ref_id && skipsSeen.has(e.ref_id) ? e.ref_id : null;
        if (key) {
          if (!explanations.has(key)) explanations.set(key, e);
          continue;
        }
      }
      list.push(e);
    }
    const groups = new Map<string, FeedEvent[]>();
    for (const e of list) {
      const k = dayKey(e.created_at);
      const arr = groups.get(k);
      if (arr) arr.push(e);
      else groups.set(k, [e]);
    }
    const sections = [...groups.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([k, data]) => ({ key: k, title: dayLabel(data[0].created_at, nowMs), data }));
    return { sections, explanations };
  }, [state, nowMs]);

  if (!state || !state.circle) {
    return (
      <Screen>
        <Center>
          <Txt variant="subhead" tone="secondary">
            {loading ? 'Loading your circle…' : 'You are not in a circle yet.'}
          </Txt>
        </Center>
      </Screen>
    );
  }

  const memberCount = state.members.length;

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Txt variant="title" numberOfLines={1}>
            {state.circle.name}
          </Txt>
          <Row gap={6} style={{ marginTop: 2 }}>
            <View style={[styles.dot, { backgroundColor: live ? colors.success : colors.textTertiary }]} />
            <Txt variant="footnote" tone="secondary">
              {memberCount} {memberCount === 1 ? 'member' : 'members'} · {live ? 'live' : 'syncing'}
            </Txt>
          </Row>
        </View>
        <StreakChip value={state.circle_streak} />
      </View>
      <Divider />
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
            explanation={item.type === 'skip' ? explanations.get(item.occurrence_id ?? '') ?? explanations.get(item.ref_id ?? '') ?? null : null}
          />
        )}
        ItemSeparatorComponent={() => <Divider />}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Txt variant="label" tone="tertiary">
              {section.title}
            </Txt>
          </View>
        )}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textSecondary} />}
        ListEmptyComponent={
          <EmptyState icon="people-outline" title="Nothing here yet" message={`Check-ins, skips and forfeits from ${state.circle.name} show up here as they happen.`} />
        }
        showsVerticalScrollIndicator={false}
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
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  list: { paddingBottom: space.xxl },
  sectionHeader: { paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.xs, backgroundColor: colors.bg },
});
