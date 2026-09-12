import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, Share, View } from 'react-native';
import { Avatar, Button, ErrorText, Group, ListRow, Row, Screen, SectionLabel, Stat, StreakChip, Txt } from '@/components/ui';
import { useCircleState } from '@/lib/circleState';
import { DEV_PANEL } from '@/lib/config';
import { useSession } from '@/lib/session';
import { errorMessage } from '@/lib/supabase';
import { space } from '@/lib/theme';

export default function You() {
  const { profile, user, signOut } = useSession();
  const { state, live } = useCircleState();
  const router = useRouter();
  const taps = useRef<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const name = profile?.display_name ?? user?.email?.split('@')[0] ?? 'You';

  function onAvatarTap() {
    const now = Date.now();
    taps.current = taps.current.filter((t) => now - t < 3000);
    taps.current.push(now);
    if (taps.current.length >= 5) {
      taps.current = [];
      if (DEV_PANEL) router.push('/dev');
    }
  }

  async function onShare() {
    if (!state?.circle) return;
    try {
      await Share.share({
        message: `Join my circle "${state.circle.name}" on Present. Invite code: ${state.circle.invite_code}`,
      });
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function onSignOut() {
    setBusy(true);
    setError(null);
    try {
      await signOut();
      router.replace('/(auth)/sign-in');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const members = [...(state?.members ?? [])].sort((a, b) => b.personal_streak - a.personal_streak);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingTop: space.lg, paddingBottom: space.xxxl }} showsVerticalScrollIndicator={false}>
        <Row gap={space.lg}>
          <Pressable onPress={onAvatarTap} hitSlop={8}>
            <Avatar name={name} uri={profile?.avatar_url} size={64} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Txt variant="title" numberOfLines={1}>
              {name}
            </Txt>
            {user?.email ? (
              <Txt variant="subhead" tone="secondary" numberOfLines={1}>
                {user.email}
              </Txt>
            ) : null}
          </View>
        </Row>

        <Row style={{ marginTop: space.xl, justifyContent: 'space-between' }}>
          <Stat value={state?.personal_streak ?? 0} label="Your streak" tone={(state?.personal_streak ?? 0) > 0 ? 'primary' : 'danger'} />
          <Stat value={state?.circle_streak ?? 0} label="Circle streak" tone={(state?.circle_streak ?? 0) > 0 ? 'primary' : 'danger'} />
          <Stat value={state?.members.length ?? 0} label="Members" align="flex-end" />
        </Row>

        {state?.circle ? (
          <>
            <SectionLabel>Circle</SectionLabel>
            <Group>
              <ListRow title={state.circle.name} subtitle={`Forfeit: ${state.circle.forfeit_text}`} trailing={<Txt variant="footnote" tone={live ? 'success' : 'tertiary'}>{live ? 'Live' : 'Syncing'}</Txt>} />
              <ListRow
                title="Invite code"
                subtitle="Friends enter this under Join"
                trailing={
                  <Row gap={space.md}>
                    <Txt variant="headline" tabular style={{ letterSpacing: 2 }}>
                      {state.circle.invite_code}
                    </Txt>
                    <Button title="Share" variant="secondary" size="sm" icon="share-outline" onPress={onShare} />
                  </Row>
                }
              />
            </Group>

            <SectionLabel>Members</SectionLabel>
            <Group>
              {members.map((m) => (
                <ListRow
                  key={m.id}
                  leading={<Avatar name={m.display_name} uri={m.avatar_url} size={32} />}
                  title={m.id === state.me ? `${m.display_name} (you)` : m.display_name}
                  trailing={<StreakChip value={m.personal_streak} size="sm" />}
                />
              ))}
            </Group>
          </>
        ) : (
          <>
            <SectionLabel>Circle</SectionLabel>
            <Group>
              <ListRow title="You're not in a circle yet" subtitle="Create one or join with a code" onPress={() => router.push('/circle')} />
            </Group>
          </>
        )}

        <SectionLabel>Settings</SectionLabel>
        <Group>
          <ListRow title="Edit schedule" onPress={() => router.push('/schedule')} />
          <ListRow title={busy ? 'Signing out…' : 'Sign out'} destructive onPress={onSignOut} chevron={false} />
        </Group>
        <ErrorText>{error}</ErrorText>

        <Txt variant="footnote" tone="tertiary" align="center" style={{ marginTop: space.xxl }}>
          Photos are circle-only and expire after 24h. Location is stored only as inside or outside the building.
        </Txt>
      </ScrollView>
    </Screen>
  );
}
