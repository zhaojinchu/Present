import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Share, StyleSheet, View } from 'react-native';
import { Button, Card, ErrorText, Field, Group, Input, ListRow, Mark, Screen, SectionLabel, Segmented, Txt } from '@/components/ui';
import { createCircle, joinCircle } from '@/lib/api/circle';
import { useCircleState } from '@/lib/circleState';
import { FORFEIT_PRESETS } from '@/lib/config';
import { useSession } from '@/lib/session';
import { errorMessage } from '@/lib/supabase';
import { colors, space, type } from '@/lib/theme';
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
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Mark size={64} />
          <Txt variant="largeTitle" style={{ marginTop: space.xl }}>
            {done.created ? 'Your circle is live.' : `You're in ${done.circle.name}.`}
          </Txt>
          <Txt variant="subhead" tone="secondary" style={{ marginTop: space.sm }}>
            The forfeit here: {done.circle.forfeit_text}.
          </Txt>
          <Card style={{ alignItems: 'center', marginTop: space.xl }}>
            <Txt variant="label" tone="tertiary">
              Invite code
            </Txt>
            <Txt variant="display" tabular style={styles.code}>
              {done.circle.invite_code}
            </Txt>
            <Txt variant="footnote" tone="secondary" align="center">
              Friends enter this under Join. Keep it to people you actually know.
            </Txt>
          </Card>
          <View style={{ gap: space.sm, marginTop: space.lg }}>
            <Button
              title="Share code"
              variant="secondary"
              icon="share-outline"
              onPress={() =>
                Share.share({
                  message: `Join my circle "${done.circle.name}" on Present. Code: ${done.circle.invite_code}`,
                }).catch(() => {})
              }
            />
            <Button title="Continue" size="lg" onPress={finish} />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: space.xl, paddingBottom: space.xxl }} showsVerticalScrollIndicator={false}>
          <Txt variant="largeTitle">Your circle</Txt>
          <Txt variant="subhead" tone="secondary" style={{ marginTop: space.sm }}>
            3 to 6 people who know each other. Your streak depends on all of them.
          </Txt>
          <Segmented
            options={[
              { value: 'create', label: 'Create' },
              { value: 'join', label: 'Join' },
            ]}
            value={mode}
            onChange={setMode}
            style={{ marginTop: space.xl }}
          />
          <View style={{ marginTop: space.xl }}>
            {mode === 'create' ? (
              <CreateForm onDone={(circle) => setDone({ circle, created: true })} />
            ) : (
              <JoinForm onDone={(circle) => setDone({ circle, created: false })} />
            )}
          </View>
          <Button
            title="Sign out"
            variant="tertiary"
            size="sm"
            style={{ marginTop: space.xxl, alignSelf: 'center' }}
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

  const check = (on: boolean) => <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={on ? colors.accent : colors.textTertiary} />;

  return (
    <View>
      <Field label="Circle name">
        <Input value={name} onChangeText={setName} placeholder="Hack House" autoCapitalize="words" maxLength={40} />
      </Field>
      <SectionLabel>The forfeit</SectionLabel>
      <Txt variant="footnote" tone="secondary" style={{ marginBottom: space.sm }}>
        What a skipper owes the circle. The app keeps score; you collect.
      </Txt>
      <Group>
        {FORFEIT_PRESETS.map((f) => (
          <ListRow key={f} title={f} trailing={check(preset === f)} chevron={false} onPress={() => setPreset(f)} />
        ))}
        <ListRow
          title="Custom"
          subtitle={
            preset === 'custom' ? (
              <Input
                value={custom}
                onChangeText={(t) => setCustom(t.slice(0, 80))}
                placeholder="e.g. carries everyone's bags to class"
                maxLength={80}
                autoFocus
                style={{ marginTop: space.sm, backgroundColor: colors.surfaceOverlay }}
              />
            ) : undefined
          }
          trailing={check(preset === 'custom')}
          chevron={false}
          onPress={() => setPreset('custom')}
        />
      </Group>
      <ErrorText>{err}</ErrorText>
      <Button title="Create circle" size="lg" loading={busy} disabled={!canSubmit} onPress={submit} style={{ marginTop: space.xl }} />
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
      <Field label="Invite code" hint="6 characters, from whoever made the circle.">
        <Input
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
          placeholder="ABC123"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
          style={styles.codeInput}
        />
      </Field>
      <ErrorText>{err}</ErrorText>
      <Button title="Join circle" size="lg" loading={busy} disabled={code.length !== 6 || busy} onPress={submit} style={{ marginTop: space.xl }} />
    </View>
  );
}

const styles = StyleSheet.create({
  code: { color: colors.accent, letterSpacing: 6, marginVertical: space.sm },
  codeInput: { ...type.title, letterSpacing: 6, textAlign: 'center', height: 60 },
});
