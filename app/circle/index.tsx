import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Button, Card, ErrorText, H1, H2, Input, Muted, P, Screen, Spacer } from '@/components/ui';
import { createCircle, joinCircle } from '@/lib/api/circle';
import { useCircleState } from '@/lib/circleState';
import { FORFEIT_PRESETS } from '@/lib/config';
import { useSession } from '@/lib/session';
import { errorMessage } from '@/lib/supabase';
import { colors, fonts, radius, space } from '@/lib/theme';
import type { Circle } from '@/lib/types';

type Mode = 'create' | 'join';

export default function CircleScreen() {
  const router = useRouter();
  const { signOut } = useSession();
  const { refresh } = useCircleState();
  const [mode, setMode] = useState<Mode>('create');
  const [done, setDone] = useState<{ circle: Circle; created: boolean } | null>(null);

  const finish = async () => {
    await refresh();
    router.replace('/' as never);
  };

  if (done) {
    return (
      <Screen>
        <Spacer h={space.xxl} />
        <H1>{done.created ? 'Your circle is live.' : `You're in ${done.circle.name}.`}</H1>
        <Spacer h={space.sm} />
        <Muted>This circle's forfeit: {done.circle.forfeit_text}</Muted>
        <Spacer h={space.xl} />
        <Card style={{ alignItems: 'center' }}>
          <Muted>Invite code</Muted>
          <Text style={styles.code}>{done.circle.invite_code}</Text>
          <Muted style={{ textAlign: 'center' }}>Friends enter this under Join. Keep it to people you actually know.</Muted>
        </Card>
        <Button
          title="Share code"
          variant="secondary"
          onPress={() =>
            Share.share({
              message: `Join my circle "${done.circle.name}" on Present. Code: ${done.circle.invite_code}`,
            }).catch(() => {})
          }
        />
        <Spacer />
        <Button title="Continue" size="lg" onPress={finish} />
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
          <Spacer h={space.xl} />
          <H1>Your circle</H1>
          <Spacer h={space.xs} />
          <Muted>3 to 6 people who know each other. Your streak depends on all of them.</Muted>
          <Spacer h={space.lg} />
          <View style={styles.segments}>
            {(['create', 'join'] as Mode[]).map((m) => (
              <Pressable key={m} onPress={() => setMode(m)} style={[styles.segment, mode === m && styles.segmentActive]}>
                <Text style={[styles.segmentText, mode === m && { color: colors.accentText }]}>{m === 'create' ? 'Create' : 'Join'}</Text>
              </Pressable>
            ))}
          </View>
          <Spacer h={space.lg} />
          {mode === 'create' ? (
            <CreateForm onDone={(circle) => setDone({ circle, created: true })} />
          ) : (
            <JoinForm onDone={(circle) => setDone({ circle, created: false })} />
          )}
          <Spacer h={space.xxl} />
          <Button
            title="Sign out"
            variant="ghost"
            size="sm"
            onPress={() => signOut().finally(() => router.replace('/(auth)/sign-in'))}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function CreateForm({ onDone }: { onDone: (c: Circle) => void }) {
  const [name, setName] = useState('');
  const [preset, setPreset] = useState<string | 'custom' | null>(FORFEIT_PRESETS[0]);
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const forfeitText = preset === 'custom' ? custom.trim() : preset ?? '';
  const canSubmit = name.trim().length > 0 && forfeitText.length > 0 && !busy;

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      onDone(await createCircle(name, forfeitText));
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <Muted>Circle name</Muted>
      <Spacer h={space.xs} />
      <Input value={name} onChangeText={setName} placeholder="Hack House" autoCapitalize="words" maxLength={40} />
      <Spacer h={space.lg} />
      <H2>The forfeit</H2>
      <Muted>What a skipper owes the circle. The app keeps score; you collect.</Muted>
      <Spacer h={space.sm} />
      {FORFEIT_PRESETS.map((f) => (
        <Pressable key={f} onPress={() => setPreset(f)}>
          <Card style={[styles.presetCard, preset === f && styles.presetActive]}>
            <P style={{ fontFamily: fonts.bold }}>{f}</P>
          </Card>
        </Pressable>
      ))}
      <Pressable onPress={() => setPreset('custom')}>
        <Card style={[styles.presetCard, preset === 'custom' && styles.presetActive]}>
          <P style={{ fontFamily: fonts.bold }}>Custom…</P>
          {preset === 'custom' ? (
            <Input
              value={custom}
              onChangeText={(t) => setCustom(t.slice(0, 80))}
              placeholder="e.g. carries everyone's bags to class"
              maxLength={80}
              autoFocus
              style={{ marginTop: space.sm }}
            />
          ) : null}
        </Card>
      </Pressable>
      <ErrorText>{err}</ErrorText>
      <Spacer />
      <Button title="Create circle" size="lg" loading={busy} disabled={!canSubmit} onPress={submit} />
    </View>
  );
}

function JoinForm({ onDone }: { onDone: (c: Circle) => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      onDone(await joinCircle(code));
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <Muted>Invite code</Muted>
      <Spacer h={space.xs} />
      <Input
        value={code}
        onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
        placeholder="ABC123"
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={6}
        style={styles.codeInput}
      />
      <ErrorText>{err}</ErrorText>
      <Spacer />
      <Button title="Join circle" size="lg" loading={busy} disabled={code.length !== 6 || busy} onPress={submit} />
    </View>
  );
}

const styles = StyleSheet.create({
  segments: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segment: { flex: 1, paddingVertical: 11, alignItems: 'center', borderRadius: radius.sm },
  segmentActive: { backgroundColor: colors.text },
  segmentText: { color: colors.muted, fontFamily: fonts.bold, fontSize: 15 },
  presetCard: { paddingVertical: 14 },
  presetActive: { backgroundColor: colors.accentSoft },
  code: { color: colors.text, fontSize: 40, fontFamily: fonts.black, marginVertical: 8 },
  codeInput: { fontSize: 28, textAlign: 'center', fontFamily: fonts.black },
});
