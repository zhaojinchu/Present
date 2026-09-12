import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { OccurrenceCard } from '@/components/OccurrenceCard';
import { StreakHeader } from '@/components/StreakHeader';
import { Button, Center, ErrorText, Muted, P, Screen, Spacer } from '@/components/ui';
import { useCircleState } from '@/lib/circleState';
import { useNow } from '@/lib/clock';
import { errorMessage } from '@/lib/supabase';
import { colors, fonts, space } from '@/lib/theme';
import type { Occurrence } from '@/lib/types';

export default function Home() {
  const { state, error, refresh } = useCircleState();
  const router = useRouter();
  const now = useNow().getTime();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const mine = useMemo<Occurrence[]>(() => {
    if (!state) return [];
    return state.today
      .filter((o) => o.user_id === state.me)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  }, [state]);

  const owed = state?.forfeits.filter((f) => f.status === 'owed') ?? [];

  const hero = useMemo(() => {
    const open = mine.find((o) => {
      if (o.status !== 'pending') return false;
      const start = new Date(o.window_start).getTime();
      const end = new Date(o.window_end).getTime();
      return now >= start && now <= end;
    });
    return open ?? mine.find((o) => o.status === 'pending') ?? mine[0] ?? null;
  }, [mine, now]);

  const rest = mine.filter((o) => o.id !== hero?.id);

  async function onRefresh() {
    setRefreshing(true);
    setRefreshError(null);
    try {
      await refresh({ maintain: true });
    } catch (e) {
      setRefreshError(errorMessage(e));
    } finally {
      setRefreshing(false);
    }
  }

  if (!state) {
    return (
      <Screen>
        <Center>
          {error ? (
            <>
              <P>Couldn't load your circle.</P>
              <Muted style={{ textAlign: 'center' }}>{error}</Muted>
              <Spacer />
              <Button title="Retry" onPress={onRefresh} loading={refreshing} />
            </>
          ) : (
            <ActivityIndicator color={colors.accent} />
          )}
        </Center>
      </Screen>
    );
  }

  const group = hero
    ? state.today.filter((x) => x.course_code === hero.course_code && x.starts_at === hero.starts_at)
    : [];
  const friendsThere = group
    .filter((x) => x.status === 'checked_in' && x.user_id !== state.me)
    .map((x) => {
      const m = state.members.find((mem) => mem.id === x.user_id);
      return { name: m?.display_name ?? x.display_name, avatar_url: m?.avatar_url };
    });

  const header = (
    <View style={{ paddingTop: space.xs }}>
      <StreakHeader circleStreak={state.circle_streak} personalStreak={state.personal_streak} circleName={state.circle?.name} />
      {!state.circle ? (
        <View style={{ marginBottom: space.lg }}>
          <P>You're not in a circle yet.</P>
          <Spacer h={space.sm} />
          <Button title="Create or join a circle" onPress={() => router.push('/circle')} />
        </View>
      ) : null}
      {hero ? (
        <OccurrenceCard
          occurrence={hero}
          othersThere={friendsThere.length}
          total={group.length}
          friendsThere={friendsThere}
          variant="hero"
        />
      ) : null}
      <ErrorText>{refreshError}</ErrorText>
    </View>
  );

  return (
    <Screen padded={false}>
      <FlatList
        data={rest}
        keyExtractor={(o) => o.id}
        ListHeaderComponent={header}
        renderItem={({ item }) => {
          const g = state.today.filter((x) => x.course_code === item.course_code && x.starts_at === item.starts_at);
          const othersThere = g.filter((x) => x.status === 'checked_in' && x.user_id !== state.me).length;
          return <OccurrenceCard occurrence={item} othersThere={othersThere} total={g.length} variant="row" />;
        }}
        ListFooterComponent={
          owed.length > 0 ? (
            <View style={{ marginTop: space.lg }}>
              {owed.map((f) => (
                <Pressable key={f.id} onPress={() => router.push(`/forfeit/${f.id}`)} hitSlop={4} style={{ paddingVertical: 8 }}>
                  <Text style={{ color: colors.amber, fontSize: 15, fontFamily: fonts.bold }}>
                    {f.owed_by_name} · {f.description} →
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null
        }
        ListEmptyComponent={
          !hero ? (
            <View style={{ paddingTop: space.lg }}>
              <P>No classes today.</P>
              <Muted style={{ marginTop: space.xs }}>Your streak is safe. Add or check your schedule if that's wrong.</Muted>
              <Spacer h={space.md} />
              <Button title="Edit schedule" variant="secondary" onPress={() => router.push('/schedule')} />
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: space.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}
