import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, Share, Text, View } from 'react-native';
import { Avatar, Button, Card, ErrorText, H1, H2, Muted, P, Row, Screen, Spacer } from '@/components/ui';
import { useCircleState } from '@/lib/circleState';
import { DEV_PANEL } from '@/lib/config';
import { useSession } from '@/lib/session';
import { errorMessage } from '@/lib/supabase';
import { colors, space } from '@/lib/theme';

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

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingVertical: space.lg, paddingBottom: space.xxl }} showsVerticalScrollIndicator={false}>
        <Row gap={space.md}>
          <Pressable onPress={onAvatarTap} hitSlop={8}>
            <Avatar name={name} uri={profile?.avatar_url} size={64} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <H1>{name}</H1>
            {user?.email ? <Muted numberOfLines={1}>{user.email}</Muted> : null}
          </View>
        </Row>
        <Spacer h={space.xl} />

        <H2 style={{ marginBottom: space.sm }}>Your circle</H2>
        {state?.circle ? (
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <P style={{ fontWeight: '700' }}>{state.circle.name}</P>
              <Muted>{live ? '● live' : '○ polling'}</Muted>
            </Row>
            <Muted style={{ marginTop: space.xs }}>Forfeit: {state.circle.forfeit_text}</Muted>
            <Spacer h={space.md} />
            <Row style={{ justifyContent: 'space-between' }}>
              <View>
                <Muted>Invite code</Muted>
                <Text style={{ color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: 4 }}>{state.circle.invite_code}</Text>
              </View>
              <Button title="Share" variant="secondary" size="sm" onPress={onShare} />
            </Row>
            <Spacer h={space.md} />
            <Muted style={{ marginBottom: space.xs }}>Members</Muted>
            {state.members.map((m) => (
              <Row key={m.id} style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
                <Row gap={space.sm}>
                  <Avatar name={m.display_name} uri={m.avatar_url} size={28} />
                  <P>
                    {m.display_name}
                    {m.id === state.me ? ' (you)' : ''}
                  </P>
                </Row>
                <Text style={{ color: m.personal_streak > 0 ? colors.text : colors.red, fontWeight: '700' }}>
                  {m.personal_streak > 0 ? '🔥' : '💀'} {m.personal_streak}
                </Text>
              </Row>
            ))}
          </Card>
        ) : (
          <Card>
            <P>You're not in a circle yet.</P>
            <Spacer h={space.sm} />
            <Button title="Create or join a circle" onPress={() => router.push('/circle')} />
          </Card>
        )}

        <Spacer h={space.md} />
        <Button title="Edit schedule" variant="secondary" onPress={() => router.push('/schedule')} />
        <Spacer h={space.sm} />
        <Button title="Sign out" variant="ghost" loading={busy} onPress={onSignOut} />
        <ErrorText>{error}</ErrorText>

        <Spacer h={space.xl} />
        <Muted style={{ textAlign: 'center' }}>
          Photos are circle-only and expire after 24h. Location is stored only as inside/outside the building.
        </Muted>
      </ScrollView>
    </Screen>
  );
}
