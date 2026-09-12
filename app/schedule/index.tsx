import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { Button, EmptyState, ErrorText, Group, ListRow, Txt } from '@/components/ui';
import { listMyClasses } from '@/lib/api/schedule';
import { useCircleState } from '@/lib/circleState';
import { useSession } from '@/lib/session';
import { errorMessage } from '@/lib/supabase';
import { colors, space } from '@/lib/theme';
import { fmtClock, fmtDays } from '@/lib/time';
import type { ClassRow } from '@/lib/types';

export default function ScheduleScreen() {
  const { onboarding } = useLocalSearchParams<{ onboarding?: string }>();
  const isOnboarding = onboarding === '1';
  const { user } = useSession();
  const { refresh } = useCircleState();
  const router = useRouter();
  const userId = user?.id ?? null;

  const [classes, setClasses] = useState<ClassRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      setClasses(await listMyClasses(userId));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
      setClasses((prev) => prev ?? []);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function onDone() {
    setBusy(true);
    try {
      await refresh({ maintain: true });
      router.replace('/');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const hasClasses = !!classes && classes.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: isOnboarding ? 'Add your classes' : 'Schedule' }} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxxl }} showsVerticalScrollIndicator={false}>
        {isOnboarding ? (
          <Txt variant="body" style={{ marginBottom: space.sm }}>
            Enter every lecture you're expected at. You can edit this later from the You tab.
          </Txt>
        ) : null}
        <Txt variant="footnote" tone="secondary" style={{ marginBottom: space.lg }}>
          Check-in window is 10 min before to 15 min after start. No check-in by 10 min after the end counts as a skip.
        </Txt>
        <ErrorText>{error}</ErrorText>

        {classes === null ? (
          <ActivityIndicator color={colors.textSecondary} style={{ marginTop: space.xl }} />
        ) : classes.length === 0 ? (
          <EmptyState icon="calendar-outline" title="No classes yet" message="Add your first one below." />
        ) : (
          <Group>
            {classes.map((item) => (
              <ListRow
                key={item.id}
                title={item.course_code}
                subtitle={[item.name, item.building_code].filter(Boolean).join(' · ')}
                trailing={
                  <View style={{ alignItems: 'flex-end' }}>
                    <Txt variant="subhead" weight="600" tabular>
                      {fmtDays(item.days_of_week)}
                    </Txt>
                    <Txt variant="footnote" tone="secondary" tabular>
                      {fmtClock(item.start_time)} to {fmtClock(item.end_time)}
                    </Txt>
                  </View>
                }
                onPress={() => router.push(`/schedule/edit?id=${item.id}`)}
              />
            ))}
          </Group>
        )}

        <View style={{ gap: space.sm, marginTop: space.xl }}>
          <Button title="Add class" icon="add" variant={hasClasses ? 'secondary' : 'primary'} onPress={() => router.push('/schedule/edit')} />
          {isOnboarding && hasClasses ? <Button title="Done" size="lg" loading={busy} onPress={onDone} /> : null}
        </View>
      </ScrollView>
    </View>
  );
}
