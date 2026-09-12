import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { OccurrenceCard } from '@/components/OccurrenceCard';
import { StreakHeader } from '@/components/StreakHeader';
import { Button, Card, Center, ErrorText, H2, Muted, P, Screen, Spacer } from '@/components/ui';
import { useCircleState } from '@/lib/circleState';
import { errorMessage } from '@/lib/supabase';
import { colors, space } from '@/lib/theme';
import type { Occurrence } from '@/lib/types';

export default function Home() {
  const { state, error, refresh } = useCircleState();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const mine = useMemo<Occurrence[]>(() => {
    if (!state) return [];
    return state.today
      .filter((o) => o.user_id === state.me)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  }, [state]);

  const owed = state?.forfeits.filter((f) => f.status === 'owed') ?? [];

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

  const header = (
    <View style={{ paddingTop: space.md }}>
      <StreakHeader circleStreak={state.circle_streak} personalStreak={state.personal_streak} circleName={state.circle?.name} />
      {!state.circle ? (
        <Card>
          <P>You're not in a circle yet.</P>
          <Spacer h={space.sm} />
          <Button title="Create or join a circle" onPress={() => router.push('/circle')} />
        </Card>
      ) : null}
      {owed.length > 0 ? (
        <Card tone={colors.amber}>
          <Muted style={{ marginBottom: space.xs }}>Owed in your circle</Muted>
          {owed.map((f) => (
            <Pressable key={f.id} onPress={() => router.push(`/forfeit/${f.id}`)} hitSlop={4} style={{ paddingVertical: 4 }}>
              <Text style={{ color: colors.text, fontSize: 15 }}>
                <Text style={{ fontWeight: '700' }}>{f.owed_by_name}</Text> {f.description}
              </Text>
            </Pressable>
          ))}
        </Card>
      ) : null}
      <H2 style={{ marginBottom: space.sm }}>Today</H2>
      <ErrorText>{refreshError}</ErrorText>
    </View>
  );

  return (
    <Screen>
      <FlatList
        data={mine}
        keyExtractor={(o) => o.id}
        ListHeaderComponent={header}
        renderItem={({ item }) => {
          const group = state.today.filter((x) => x.course_code === item.course_code && x.starts_at === item.starts_at);
          const othersThere = group.filter((x) => x.status === 'checked_in' && x.user_id !== state.me).length;
          return <OccurrenceCard occurrence={item} othersThere={othersThere} total={group.length} />;
        }}
        ListEmptyComponent={
          <Card>
            <P>No classes today.</P>
            <Muted style={{ marginTop: space.xs }}>Your streak is safe. Add or check your schedule if that's wrong.</Muted>
            <Spacer h={space.md} />
            <Button title="Edit schedule" variant="secondary" onPress={() => router.push('/schedule')} />
          </Card>
        }
        contentContainerStyle={{ paddingBottom: space.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}
