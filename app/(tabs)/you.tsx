import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, Share, Text, View } from 'react-native';
import { Avatar, Button, Card, ErrorText, H1, Label, Muted, P, Row, Screen, Spacer } from '@/components/ui';
import { useCircleState } from '@/lib/circleState';
import { DEV_PANEL, UI_PREVIEW } from '@/lib/config';
import { PREVIEW } from '@/lib/preview';
import { useSession } from '@/lib/session';
import { errorMessage } from '@/lib/supabase';
import { colors, fonts, space } from '@/lib/theme';

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
        <View style={{ alignItems: 'center', paddingTop: space.sm, paddingBottom: space.xl }}>
          <Pressable onPress={onAvatarTap} hitSlop={8}>
            <Avatar name={name} uri={profile?.avatar_url} size={96} />
          </Pressable>
          <H1 style={{ marginTop: space.md }}>{name}</H1>
          {user?.email ? <Muted numberOfLines={1}>{user.email}</Muted> : null}
        </View>

        <Label style={{ marginBottom: space.sm }}>Your circle</Label>
        {state?.circle ? (
          <Card>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <P style={{ fontFamily: fonts.black, fontSize: 18 }}>{state.circle.name}</P>
              <Muted>{live ? '● live' : '○ polling'}</Muted>
            </Row>
            <Muted style={{ marginTop: space.xs }}>Forfeit: {state.circle.forfeit_text}</Muted>
            <View style={{ marginTop: space.lg }}>
              <Label>Invite code</Label>
              <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <Text style={{ color: colors.text, fontSize: 32, fontFamily: fonts.black }}>{state.circle.invite_code}</Text>
                <Button title="Share" variant="secondary" size="sm" onPress={onShare} />
              </Row>
            </View>
            <Spacer h={space.md} />
            <Label style={{ marginBottom: space.xs }}>Members</Label>
            {state.members.map((m) => (
              <Row key={m.id} style={{ justifyContent: 'space-between', paddingVertical: 8 }}>
                <Row gap={space.sm}>
                  <Avatar name={m.display_name} uri={m.avatar_url} size={32} />
                  <P>
                    {m.display_name}
                    {m.id === state.me ? ' (you)' : ''}
                  </P>
                </Row>
                <Text style={{ color: m.personal_streak > 0 ? colors.text : colors.red, fontFamily: fonts.black }}>
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

        {UI_PREVIEW ? (
          <>
            <Spacer h={space.xl} />
            <Label style={{ marginBottom: space.sm }}>Browse every screen</Label>
            <Muted style={{ marginBottom: space.sm }}>Local preview. Buttons work, nothing is saved to a server.</Muted>
            <Button title="Check in (camera)" variant="secondary" onPress={() => router.push(`/checkin/${PREVIEW.occ122Me}`)} />
            <Spacer h={space.sm} />
            <Button title="Explain a skip" variant="secondary" onPress={() => router.push(`/explain/${PREVIEW.skipMe}`)} />
            <Spacer h={space.sm} />
            <Button title="Forfeit Alex owes" variant="secondary" onPress={() => router.push(`/forfeit/${PREVIEW.forfeitAlex}`)} />
            <Spacer h={space.sm} />
            <Button title="Forfeit you owe" variant="secondary" onPress={() => router.push(`/forfeit/${PREVIEW.forfeitMe}`)} />
            <Spacer h={space.sm} />
            <Button title="Paid forfeit" variant="secondary" onPress={() => router.push(`/forfeit/${PREVIEW.forfeitSamPaid}`)} />
            <Spacer h={space.sm} />
            <Button title="Create / join circle" variant="secondary" onPress={() => router.push('/circle')} />
            <Spacer h={space.sm} />
            <Button title="Demo controls" variant="secondary" onPress={() => router.push('/dev')} />
          </>
        ) : null}

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
