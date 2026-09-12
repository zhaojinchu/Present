import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, View } from 'react-native';
import { OccurrenceRow, OpenClassCard, isWindowOpen } from '@/components/OccurrenceCard';
import { StreakHeader } from '@/components/StreakHeader';
import { Button, Center, EmptyState, ErrorText, Group, IconBadge, ListRow, Screen, SectionLabel, Txt } from '@/components/ui';
import { useCircleState } from '@/lib/circleState';
import { useNow } from '@/lib/clock';
import { errorMessage } from '@/lib/supabase';
import { colors, space } from '@/lib/theme';
import { fmtDate } from '@/lib/time';
import type { Occurrence } from '@/lib/types';

export default function Home() {
  const { state, error, refresh } = useCircleState();
  const router = useRouter();
  const now = useNow(1000).getTime();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const mine = useMemo<Occurrence[]>(() => {
    if (!state) return [];
    return state.today
      .filter((o) => o.user_id === state.me)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  }, [state]);

  const open = mine.filter((o) => isWindowOpen(o, now));
  const rest = mine.filter((o) => !isWindowOpen(o, now));
  const owed = state?.forfeits.filter((f) => f.status === 'owed') ?? [];

  // Who in the circle has a class today, and who has already checked in.
  const presence = useMemo(() => {
    if (!state) return { present: [], total: 0 };
    const withClass = new Set(state.today.map((o) => o.user_id));
    const checkedIn = new Map<string, { name: string; uri?: string | null }>();
    for (const o of state.today) {
      if (o.status === 'checked_in' && !checkedIn.has(o.user_id)) {
        const m = state.members.find((x) => x.id === o.user_id);
        checkedIn.set(o.user_id, { name: o.display_name, uri: m?.avatar_url });
      }
    }
    return { present: [...checkedIn.values()], total: withClass.size };
  }, [state]);

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
            <EmptyState icon="cloud-offline-outline" title="Couldn't load your circle" message={error} action={<Button title="Retry" onPress={onRefresh} loading={refreshing} />} />
          ) : (
            <ActivityIndicator color={colors.textSecondary} />
          )}
        </Center>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingTop: space.sm, paddingBottom: space.xxxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textSecondary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ marginBottom: space.lg }}>
          <Txt variant="largeTitle">Today</Txt>
          <Txt variant="subhead" tone="secondary">
            {fmtDate(now)}
          </Txt>
        </View>

        <StreakHeader
          circleStreak={state.circle_streak}
          personalStreak={state.personal_streak}
          circleName={state.circle?.name}
          present={presence.present}
          total={presence.total}
        />

        {!state.circle ? (
          <Group style={{ marginBottom: space.lg }}>
            <ListRow leading={<IconBadge name="people-outline" />} title="You're not in a circle yet" subtitle="Create one or join with a code" onPress={() => router.push('/circle')} />
          </Group>
        ) : null}

        {owed.length > 0 ? (
          <Group style={{ marginBottom: space.lg }}>
            {owed.map((f) => (
              <ListRow
                key={f.id}
                leading={<IconBadge name="alert" tone="warning" />}
                title={
                  <Txt variant="body" numberOfLines={1}>
                    <Txt variant="headline">{f.owed_by_name}</Txt> owes: {f.description}
                  </Txt>
                }
                subtitle={`${f.course_code} · not paid yet`}
                onPress={() => router.push(`/forfeit/${f.id}`)}
              />
            ))}
          </Group>
        ) : null}

        {open.map((o) => {
          const group = state.today.filter((x) => x.course_code === o.course_code && x.starts_at === o.starts_at);
          const there = group
            .filter((x) => x.status === 'checked_in' && x.user_id !== state.me)
            .map((x) => ({ name: x.display_name, uri: state.members.find((m) => m.id === x.user_id)?.avatar_url }));
          return <OpenClassCard key={o.id} occurrence={o} there={there} total={group.length} />;
        })}

        <SectionLabel style={{ marginTop: 0 }}>Classes</SectionLabel>
        <ErrorText>{refreshError}</ErrorText>
        {mine.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title="No classes today"
            message="Your streak is safe. If that's wrong, check your schedule."
            action={<Button title="Edit schedule" variant="secondary" onPress={() => router.push('/schedule')} />}
          />
        ) : rest.length === 0 ? (
          <Txt variant="footnote" tone="tertiary" style={{ paddingVertical: space.sm }}>
            That's everything for today.
          </Txt>
        ) : (
          <Group>
            {rest.map((o) => (
              <OccurrenceRow key={o.id} occurrence={o} />
            ))}
          </Group>
        )}
      </ScrollView>
    </Screen>
  );
}
