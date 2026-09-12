import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Share, StyleSheet, View } from 'react-native';
import { FeedCard } from '@/components/feed/FeedCard';
import { PresentWordmark } from '@/components/feed/PresentWordmark';
import { Center, Muted, P, Screen } from '@/components/ui';
import { useCircleState } from '@/lib/circleState';
import { useNow } from '@/lib/clock';
import { colors } from '@/lib/theme';
import type { FeedEvent } from '@/lib/types';

export default function FeedScreen() {
  const { state, refresh, loading } = useCircleState();
  const now = useNow(30_000);
  const nowMs = now.getTime();
  const listRef = useRef<FlatList<FeedEvent>>(null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh({ maintain: true });
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const feed = useMemo(() => {
    if (!state) return [];
    return [...state.feed].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [state]);

  const activityCount = (state?.forfeits.filter((f) => f.status === 'owed').length ?? 0) + (state?.my_unexplained_skips.length ?? 0);

  const onShare = () => {
    if (!state?.circle) return;
    Share.share({
      message: `Join my circle "${state.circle.name}" on Present. Invite code: ${state.circle.invite_code}`,
    }).catch(() => {});
  };

  const onActivity = () => {
    const index = feed.findIndex((e) => e.type === 'forfeit_owed' || e.type === 'skip');
    if (index >= 0) listRef.current?.scrollToIndex({ index, animated: true, viewOffset: 8 });
  };

  if (!state || !state.circle) {
    return (
      <Screen>
        <Center>
          <Muted>{loading ? 'Loading your circle...' : 'You are not in a circle yet.'}</Muted>
        </Center>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <View style={styles.page}>
        <View style={styles.topBar}>
          <PresentWordmark />
          <View style={styles.topIcons}>
            <Pressable onPress={onActivity} hitSlop={8} style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.55 }]}>
              <Ionicons name="heart-outline" size={26} color={colors.text} />
              {activityCount > 0 ? <View style={styles.badge} /> : null}
            </Pressable>
            <Pressable onPress={onShare} hitSlop={8} style={({ pressed }) => pressed && { opacity: 0.55 }}>
              <Ionicons name="paper-plane-outline" size={24} color={colors.text} />
            </Pressable>
          </View>
        </View>

        <FlatList
          ref={listRef}
          data={feed}
          keyExtractor={(item) => item.id}
          onScrollToIndexFailed={() => {}}
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
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Center style={{ paddingTop: 80 }}>
              <P style={{ textAlign: 'center' }}>No posts yet.</P>
              <Muted style={{ textAlign: 'center', marginTop: 8 }}>
                Check-ins from {state.circle.name} show up here.
              </Muted>
            </Center>
          }
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, width: '100%', backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 2,
    paddingBottom: 4,
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: colors.igHairline,
  },
  topIcons: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  iconBtn: { position: 'relative' },
  badge: {
    position: 'absolute',
    top: -1,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.like,
    borderWidth: 1,
    borderColor: colors.white,
  },
  list: { paddingBottom: 40 },
});
