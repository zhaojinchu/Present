import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { Button, Center, ErrorText, H1, Muted, P, Screen, Spacer } from '@/components/ui';
import { excuseSkip, explainSkip } from '@/lib/api/circle';
import { useCircleState } from '@/lib/circleState';
import { EXPLANATION_MAX } from '@/lib/config';
import { errorMessage } from '@/lib/supabase';
import { colors, radius, space } from '@/lib/theme';
import { fmtTime } from '@/lib/time';
import type { UnexplainedSkip } from '@/lib/types';

export default function ExplainModal() {
  const { skipId } = useLocalSearchParams<{ skipId: string }>();
  const router = useRouter();
  const { state, refresh } = useCircleState();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<'post' | 'excuse' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // After posting, the refreshed state no longer lists this skip; keep the last resolved one
  // so the form does not flash "Nothing to explain" in the frame before we close.
  const [resolved, setResolved] = useState<UnexplainedSkip | null>(null);

  const raw = Array.isArray(skipId) ? skipId[0] : skipId ?? '';
  const found = raw.startsWith('occ:')
    ? state?.my_unexplained_skips.find((s) => s.occurrence_id === raw.slice(4))
    : state?.my_unexplained_skips.find((s) => s.id === raw);
  if (found && found.id !== resolved?.id) setResolved(found);
  const skip = found ?? resolved;

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/' as never);
  };

  if (!skip) {
    return (
      <Screen>
        <Center>
          <P>Nothing to explain</P>
          <Spacer />
          <Button title="Close" variant="ghost" onPress={close} />
        </Center>
      </Screen>
    );
  }

  const post = async () => {
    setBusy('post');
    setErr(null);
    try {
      await explainSkip(skip.id, text);
      await refresh();
      close();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const excuse = async () => {
    setBusy('excuse');
    setErr(null);
    try {
      await excuseSkip(skip.id);
      await refresh();
      close();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Spacer h={space.xl} />
        <H1>You skipped {skip.course_code}.</H1>
        <Spacer h={space.xs} />
        <Muted>
          {fmtTime(skip.starts_at)} · Your circle is waiting.
        </Muted>
        <Spacer h={space.xl} />
        <TextInput
          value={text}
          onChangeText={(t) => setText(t.slice(0, EXPLANATION_MAX))}
          placeholder="One line. Make it good."
          placeholderTextColor={colors.faint}
          multiline
          maxLength={EXPLANATION_MAX}
          autoFocus
          style={styles.input}
        />
        <Muted style={{ textAlign: 'right', marginTop: 4 }}>
          {text.length}/{EXPLANATION_MAX}
        </Muted>
        <ErrorText>{err}</ErrorText>
        <Spacer />
        <Button title="Post" size="lg" loading={busy === 'post'} disabled={text.trim().length === 0 || busy !== null} onPress={post} />
        <Spacer h={space.xl} />
        <View style={styles.divider} />
        <Spacer h={space.lg} />
        <Button title="It was sick / emergency" variant="ghost" loading={busy === 'excuse'} disabled={busy !== null} onPress={excuse} />
        <Muted style={{ textAlign: 'center', marginTop: space.sm }}>No forfeit, streak stays. Your circle will see it.</Muted>
        <View style={{ flex: 1 }} />
        <Button title="Later" variant="ghost" onPress={close} style={{ marginBottom: space.xl }} />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.cardAlt,
    color: colors.text,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    fontSize: 18,
    minHeight: 110,
    textAlignVertical: 'top',
  },
  divider: { height: 1, backgroundColor: colors.border },
});
