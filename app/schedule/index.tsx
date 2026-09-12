import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { Button, Card, ErrorText, Muted, P, Row, Spacer } from '@/components/ui';
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.lg }}>
      <Stack.Screen options={{ title: isOnboarding ? 'Add your classes' : 'Your schedule' }} />
      <FlatList
        data={classes ?? []}
        keyExtractor={(c) => c.id}
        ListHeaderComponent={
          <View style={{ paddingTop: space.md, paddingBottom: space.sm }}>
            {isOnboarding ? (
              <P style={{ marginBottom: space.sm }}>Enter every lecture you're expected at. You can edit this later from the You tab.</P>
            ) : null}
            <Muted>Check-in window: 10 min before to 15 min after start. Skip = no check-in by 10 min after the end.</Muted>
            <ErrorText>{error}</ErrorText>
            <Spacer h={space.sm} />
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/schedule/edit?id=${item.id}`)}>
            <Card>
              <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>{item.course_code}</Text>
                  {item.name ? <Muted numberOfLines={1}>{item.name}</Muted> : null}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: colors.text, fontWeight: '600' }}>
                    {fmtDays(item.days_of_week)} · {fmtClock(item.start_time)} – {fmtClock(item.end_time)}
                  </Text>
                  <Muted>{item.building_code}</Muted>
                </View>
              </Row>
            </Card>
          </Pressable>
        )}
        ListEmptyComponent={
          classes === null ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: space.xl }} />
          ) : (
            <Card>
              <P>No classes yet.</P>
              <Muted style={{ marginTop: space.xs }}>Add your first one below.</Muted>
            </Card>
          )
        }
        ListFooterComponent={
          <View style={{ paddingVertical: space.md, paddingBottom: space.xxl }}>
            <Button title="Add class" variant={classes && classes.length > 0 ? 'secondary' : 'primary'} onPress={() => router.push('/schedule/edit')} />
            {isOnboarding && classes && classes.length > 0 ? (
              <>
                <Spacer h={space.sm} />
                <Button title="Done" size="lg" loading={busy} onPress={onDone} />
              </>
            ) : null}
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
